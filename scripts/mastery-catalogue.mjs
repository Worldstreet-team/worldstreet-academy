/**
 * Install/update the 12 WorldStreet Mastery Academy programs (title, school,
 * spec copy, packages) into the `courses` collection. Idempotent: re-running
 * with --apply after a clean run reports 0 modifications.
 *
 *   node scripts/mastery-catalogue.mjs           # dry run — prints the plan
 *   node scripts/mastery-catalogue.mjs --apply   # writes
 *
 * Phase 13 (D21): the 12 programs are filed under the seven schools, and
 * `category` is the school's short label. Run `migrate-schools-v2.mjs` first;
 * never run a pre-Phase 13 copy of this script after it (it would move the
 * programs back to retired slugs). Each MATCH prints `school: <existing> -> <new>`.
 *
 * Modeled on scripts/_swap-catalogue.mjs (dotenv, mongoose.connect, raw
 * db.collection("courses"), --apply gate). Differs from it in one way that
 * matters: this script never archives or deletes, and every program is
 * diffed and written individually (rather than one bulk insertMany) because
 * each of the 12 needs its own match/insert/rename decision and slug check.
 *
 * This is a plain .mjs maintenance script — it cannot import the app's TS,
 * so the shapes below are duplicated literally from:
 *   - lib/db/models/course.ts   (ICoursePackage / IPackageEntitlements)
 *   - lib/schools.ts            (SchoolSlug -> short label + blurb)
 * If either of those files changes shape, update the literals here too.
 *
 * Matching is by exact `title`, not slug — production slugs carry random
 * suffixes from scripts/_swap-catalogue.mjs, so slug can't be a key. Two
 * programs carry a legacy title alias for the D10 rename:
 *   "Content Creation / Video Editing Mastery"   -> "Content Creation Mastery"
 *   "Artificial Intelligence & AI Automation"    -> "AI & AI Automation"
 *
 * On MATCH this $sets title, school, category, packages, price and pricing
 * unconditionally — `packages` is replaced wholesale, so every plan's name,
 * tagline, duration, features and entitlements are rewritten, not only prices
 * (the dry run prints a `plan <key>: …` diff line per plan) — plus shortDescription/description/whatYouWillLearn only
 * for the 3 programs the spec gives copy for (Forex, Crypto, AI & AI
 * Automation) — every other program's existing copy is left untouched. It
 * never touches thumbnailUrl, status, instructor, enrolledCount or rating on
 * an existing row, and never deletes or archives anything.
 *
 * Plans (institutional blueprint §9, decision D23; prices from Owen,
 * 2026-10-28, replacing the 2026-10-03 49/199/999 ladder): every one of the
 * 12 programs sells the same three plans — Basic "Foundation" $49 (4 weeks),
 * Standard "Mastery" $99 (8–12 weeks, the highlighted "most popular") and
 * Executive "Personalized Mastery" $199 (Flexible schedule). `price` is what
 * checkout charges. `listPrice` (a struck-through "was" price) is null: the
 * blueprint's $300/$1,000/$10,000 fees are not used, so no plan shows one. Basic = recorded classes,
 * assignments, assessments and the certificate (BASIC_TIER) — no live classes
 * and no instructor Q&A; Standard is STANDARD_TIER; Executive is FULL. Every
 * program gets the one §9 feature list per plan (BASIC_FEATURES,
 * STANDARD_FEATURES, EXECUTIVE_FEATURES); Executive keeps the owner's two
 * extra promises, "Lifetime mentorship access" and "Access to the signal
 * group". Plan names stay program-specific ("Forex Foundation").
 *
 * Price: every program's scalar `price` and `pricing` are DERIVED from its
 * plans — `price` = the cheapest *enabled* plan ($49, Basic), `pricing` =
 * "paid" while that is above 0 — the same rule as pricingFromPackages in
 * lib/entitlements.ts, and $set on MATCH too, so a stale scalar self-heals.
 * Before 2026-10-03 only Forex, Crypto and AI derived theirs; the other 9
 * kept their own scalar (49 or 99) and sold one full-access package at it.
 *
 * Slug: on MATCH, if the clean slugify(title) isn't held by any *other*
 * course, it is $set; otherwise the existing slug is kept and a warning is
 * printed. On INSERT, a clean-slug collision is treated as a title-drift
 * signal (see below) and aborts the run instead of falling back to a
 * timestamped slug — a silent fallback would hide the exact case this guards
 * against.
 *
 * updatedAt is deliberately NOT bumped on a no-op $set (raw collection
 * writes bypass Mongoose's timestamps middleware anyway) — bumping it on
 * every idempotent re-run would make modifiedCount nonzero forever and
 * break the idempotency check the brief requires.
 *
 * ---------------------------------------------------------------------
 * Production-safety guards (final review, Important #3 / #4):
 *
 * - PRICE: applying this changes what existing programs charge and what
 *   each price buys — e.g. a single-package program at 99 (full access)
 *   becomes Basic 49 (recorded classes, assignments, assessments and the
 *   certificate, but no live classes or Q&A), Standard 99 and Executive 199 (full access) — see the boxed WARNING printed
 *   at the top of every run, which lists each program's scalar price and
 *   enabled plan prices, current -> new. Any --apply that would change an
 *   *existing* row's scalar price OR its enabled plan prices (mock DBs
 *   included) requires --allow-price-change; without it the affected rows
 *   are printed and the process exits 1 before any write. List prices,
 *   durations and copy are display-only and never need the flag. A re-run
 *   with no pending price change never needs it.
 * - IDENTITY: title matching is scoped to `instructor: owner._id` first,
 *   falling back to an unscoped title match only with a printed
 *   `WARN adopted row owned by <email>`. A title held by more than one
 *   course prints `WARN duplicate title` and that program is skipped
 *   entirely (no write). Every MATCH/RENAME line echoes the row's `_id`,
 *   `status`, owner email and current `price` so an operator can confirm
 *   it is the right document. Before an INSERT, a pre-existing course
 *   already holding the clean slug aborts the whole run
 *   (`ABORT: slug <x> exists on "<title>" — title drift?`) rather than
 *   silently creating a second copy.
 * - URLS: a MATCH keeps its existing slug (2026-10-05: production slugs
 *   like `forex-trading-mastery-j7g0ta` are already shared, and an old slug
 *   has no redirect). `--rename-slugs` restores the clean-slug rewrite.
 *
 * - ACCESS: the plan diff lines (`plan <key>: …`) show every change per plan.
 *   An --apply that would turn OFF a flag an existing plan has on (for
 *   example access an admin granted by hand in the editor) prints the
 *   affected programs and exits 1 before any write, unless
 *   --allow-access-loss is passed. Use it only on the owner's written go.
 *
 *   node scripts/mastery-catalogue.mjs --apply --allow-price-change
 * ---------------------------------------------------------------------
 */
import mongoose from "mongoose"
import { config } from "dotenv"
config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")
const ALLOW_PRICE_CHANGE = process.argv.includes("--allow-price-change")
const RENAME_SLUGS = process.argv.includes("--rename-slugs")
const ALLOW_ACCESS_LOSS = process.argv.includes("--allow-access-loss")

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set — refusing to run.")
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db
console.log(`Target database: ${db.databaseName}`)

// ---- duplicated from lib/schools.ts (slug -> short label + card blurb) ----
const SCHOOLS = {
  "trading-financial-markets": {
    short: "Trading & Financial Markets",
    blurb: "Learn about Forex, cryptocurrency, market analysis, risk management and trading psychology.",
  },
  "technology-ai": {
    short: "Technology & AI",
    blurb: "Build practical skills in artificial intelligence, software, data and cybersecurity.",
  },
  "digital-business": {
    short: "Digital Business",
    blurb: "Build practical skills for selling, marketing, e-commerce and working in the global digital economy.",
  },
  "entrepreneurship-wealth-creation": {
    short: "Entrepreneurship & Wealth Creation",
    blurb: "Learn to start, run and grow a business, and the principles of investing and building wealth.",
  },
  "creative-economy": {
    short: "Creative Economy",
    blurb: "Turn ideas into compelling design, video and content, and build skills for the creator economy.",
  },
  "leadership-personal-development": {
    short: "Leadership & Personal Development",
    blurb: "Develop the leadership, communication and personal effectiveness that turn knowledge into results.",
  },
  "emerging-technologies": {
    short: "Emerging Technologies",
    blurb: "Understand blockchain, Web3, FinTech and the technologies shaping what comes next.",
  },
}

// ---- duplicated from lib/db/models/course.ts (ICoursePackage / IPackageEntitlements) ----
const FULL = { liveClasses: true, instructorQa: true, assignments: true, certificate: true, mentorship: true, prioritySupport: true, recordings: true }
// Basic (institutional blueprint §9, D23): recorded classes, assignments, assessments and the certificate — no live classes, no instructor Q&A.
const BASIC_TIER = { liveClasses: false, instructorQa: false, assignments: true, certificate: true, mentorship: false, prioritySupport: false, recordings: true }
// Standard-tier ladder rung: live classes + recordings + Q&A + assignments + certificate, no mentorship/priority support.
const STANDARD_TIER = { liveClasses: true, instructorQa: true, assignments: true, certificate: true, mentorship: false, prioritySupport: false, recordings: true }

function pkg(key, name, tagline, price, features, entitlements, { highlight = false, ctaLabel = null, enabled = true, listPrice = null, duration = null } = {}) {
  return { key, name, tagline, price, listPrice, duration, features, highlight, ctaLabel, enabled, entitlements }
}

/** Course-level price for every program: the cheapest enabled package. */
function minEnabledPrice(packages) {
  const enabled = packages.filter((p) => p.enabled)
  if (enabled.length === 0) throw new Error("minEnabledPrice: no enabled packages to derive a price from")
  return Math.min(...enabled.map((p) => p.price))
}

// Ladder order, as lib/entitlements.ts PACKAGE_RANK.
const RANK = { basic: 1, standard: 2, executive: 3 }

/** "49/99/199" — a row's enabled package prices in ladder order; "none" when it sells none. */
function ladderPrices(packages) {
  const enabled = (packages ?? [])
    .filter((p) => p.enabled !== false)
    .sort((a, b) => (RANK[a.key] ?? 9) - (RANK[b.key] ?? 9))
  return enabled.length > 0 ? enabled.map((p) => p.price).join("/") : "none"
}

// ---------------------------------------------------------------------------
// The three plans every program sells. Prices are Owen's (2026-10-28):
// `price` is what checkout charges; `listPrice` stays null (no struck-through
// "was" price — the blueprint's $300/$1,000/$10,000 fees are not used).
// Everything else is institutional blueprint §9 and decision D23: Foundation
// (4 weeks), Mastery (8–12 weeks), Personalized Mastery (Flexible schedule).
// Basic = recorded classes, assignments, assessments and the certificate, with
// no live classes and no instructor Q&A. Every program gets the same §9 feature
// list per plan (the program's subject lives on in whatYouWillLearn); Executive
// keeps the owner's two extra promises, "Lifetime mentorship access" and
// "Access to the signal group".
// ---------------------------------------------------------------------------

const BASIC_FEATURES = [
  "Foundation lessons", "Core concepts", "Selected recorded classes", "Learning materials", "Student community",
  "Basic assignments", "Basic assessments", "Student dashboard", "Certificate of completion where applicable",
]
const STANDARD_FEATURES = [
  "Everything in Basic", "Beginner-to-advanced curriculum", "Full live cohort", "Practical assignments", "Projects",
  "Instructor interaction", "Assessments", "Mentorship in your live cohort", "Advanced resources and community",
]
const EXECUTIVE_FEATURES = [
  "Everything in Standard", "Dedicated/private tutor", "One-on-one sessions", "Personalized learning plan",
  "Flexible scheduling", "Individual feedback", "Private mentorship", "Progress reviews", "Personalized projects",
  "Executive community", "Premium support", "Lifetime mentorship access", "Access to the signal group",
]

const PLAN = {
  basic: { label: "Basic", tagline: "Foundation", price: 49, listPrice: null, duration: "4 weeks", entitlements: BASIC_TIER, features: BASIC_FEATURES, highlight: false, ctaLabel: null },
  standard: { label: "Standard", tagline: "Mastery", price: 99, listPrice: null, duration: "8–12 weeks", entitlements: STANDARD_TIER, features: STANDARD_FEATURES, highlight: true, ctaLabel: null },
  executive: { label: "Executive", tagline: "Personalized Mastery", price: 199, listPrice: null, duration: "Flexible schedule", entitlements: FULL, features: EXECUTIVE_FEATURES, highlight: false, ctaLabel: "Apply / Enrol for $199" },
}

/** A program's three plans from its plan names: `{ basic, standard, executive }`; everything else comes from PLAN. */
function ladder(names) {
  return ["basic", "standard", "executive"].map((key) => {
    const plan = PLAN[key]
    return pkg(key, names[key], plan.tagline, plan.price, plan.features, plan.entitlements, {
      highlight: plan.highlight,
      ctaLabel: plan.ctaLabel,
      listPrice: plan.listPrice,
      duration: plan.duration,
    })
  })
}

/** Plan names for a program the spec names none for, from its subject. */
function genericLadder(subject) {
  return ladder({ basic: `${subject} Foundation`, standard: `${subject} Mastery`, executive: `Private ${subject} Mentorship` })
}

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")

// ---------------------------------------------------------------------------
// Spec copy (blueprint §5-8), embedded verbatim.
// ---------------------------------------------------------------------------

const FOREX_WYL = [
  "Forex fundamentals", "Currency pairs", "Market structure", "Candlestick analysis",
  "Technical analysis", "Fundamental analysis", "Trading strategies", "Risk management",
  "Trading psychology", "Trade planning", "Market analysis", "Position sizing",
  "Trading discipline", "Practical application",
]
const forexPackages = ladder({ basic: "Forex Foundation", standard: "Forex Mastery", executive: "Private Forex Mentorship" })

const CRYPTO_WYL = [
  "Cryptocurrency fundamentals", "Bitcoin & digital assets", "Blockchain fundamentals", "Exchanges & wallets",
  "Market structure", "Technical analysis", "Fundamental analysis", "Trading strategies", "Risk management",
  "Trading psychology", "Portfolio principles", "Crypto security", "Practical market analysis",
]
const cryptoPackages = ladder({ basic: "Crypto Foundation", standard: "Crypto Mastery", executive: "Private 1-on-1 Crypto Mentorship" })

const AI_WYL = [
  "AI fundamentals", "Prompt engineering", "AI productivity tools", "Content automation",
  "Business automation", "Workflow design", "AI-assisted research", "AI for marketing",
  "AI for productivity", "Building automated workflows",
]

// ---------------------------------------------------------------------------
// The 12 programs (title -> school slug, plans). Every program's scalar price
// is derived from its plans (the cheapest enabled one) — none carries its own.
// ---------------------------------------------------------------------------

const PROGRAMS = [
  {
    title: "Forex Trading Mastery", legacyTitles: [], school: "trading-financial-markets",
    newInsertDraft: false,
    spec: {
      shortDescription: "Learn the fundamentals and advanced concepts of Forex trading through a structured learning pathway.",
      description: "Want to understand how the Forex market works? Want to stop relying on random information and start developing a structured understanding of the market? The Forex Trading Mastery program is designed to take you through a structured learning journey—from foundational concepts to advanced market analysis and trading principles.",
      whatYouWillLearn: FOREX_WYL,
    },
    buildPackages: () => forexPackages,
  },
  {
    title: "Crypto Trading Mastery", legacyTitles: [], school: "trading-financial-markets",
    newInsertDraft: false,
    spec: {
      shortDescription: "Understand digital assets, crypto markets, analysis, security and responsible trading principles.",
      description: "Cryptocurrency has created an entirely new financial and technological ecosystem. But entering the crypto market without proper knowledge can expose you to unnecessary risk. Our Crypto Trading Mastery program is designed to help you understand digital assets, market dynamics, analysis, risk management and responsible trading practices.",
      whatYouWillLearn: CRYPTO_WYL,
    },
    buildPackages: () => cryptoPackages,
  },
  {
    title: "Blockchain Technology Mastery", legacyTitles: [], school: "emerging-technologies",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Blockchain"),
  },
  {
    title: "AI & AI Automation", legacyTitles: ["Artificial Intelligence & AI Automation"], school: "technology-ai",
    newInsertDraft: false,
    spec: {
      shortDescription: "Turn Artificial Intelligence into a practical skill.",
      description: "AI isn't just changing technology. It's changing how businesses operate, how people work and how opportunities are created. This program introduces you to practical AI tools, automation workflows and real-world applications.",
      whatYouWillLearn: AI_WYL,
    },
    buildPackages: () => genericLadder("AI"),
  },
  {
    title: "App Development with AI", legacyTitles: [], school: "technology-ai",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("App Development"),
  },
  {
    title: "Cybersecurity", legacyTitles: [], school: "technology-ai",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Cybersecurity"),
  },
  {
    title: "Data Analysis", legacyTitles: [], school: "technology-ai",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Data Analysis"),
  },
  {
    title: "Content Creation Mastery", legacyTitles: ["Content Creation / Video Editing Mastery"], school: "creative-economy",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Content Creation"),
  },
  {
    title: "Video Editing Mastery", legacyTitles: [], school: "creative-economy",
    newInsertDraft: true, spec: null, buildPackages: () => genericLadder("Video Editing"),
  },
  {
    title: "Tech Sales & Digital Marketing", legacyTitles: [], school: "digital-business",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Tech Sales & Marketing"),
  },
  {
    title: "E-Commerce & Digital Business", legacyTitles: [], school: "digital-business",
    newInsertDraft: true, spec: null, buildPackages: () => genericLadder("E-Commerce"),
  },
  {
    title: "Virtual Assistance", legacyTitles: [], school: "digital-business",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Virtual Assistance"),
  },
]

for (const program of PROGRAMS) {
  if (!SCHOOLS[program.school]) throw new Error(`Unknown school slug "${program.school}" for program "${program.title}"`)
}

// ---------------------------------------------------------------------------
// Owner for inserts.
// ---------------------------------------------------------------------------

const OWNER_EMAIL = "samsonrichfield@gmail.com"
const owner =
  (await db.collection("users").findOne({ email: OWNER_EMAIL })) ??
  (await db.collection("users").findOne({ role: { $in: ["ADMIN", "INSTRUCTOR"] } }))
if (!owner) {
  console.error(`No owner found: neither ${OWNER_EMAIL} nor any ADMIN/INSTRUCTOR user exists.`)
  process.exit(1)
}
console.log(`Owner for inserts: ${owner.email} (${owner._id})`)

// ---------------------------------------------------------------------------
// Slug normalization: keep the clean slugify(title) unless another course
// already holds it. `existingId` null means we're planning an insert.
// ---------------------------------------------------------------------------

async function resolveSlug(title, existingId) {
  const clean = slugify(title)
  const query = existingId ? { slug: clean, _id: { $ne: existingId } } : { slug: clean }
  const conflict = await db.collection("courses").findOne(query)
  if (!conflict) return { slug: clean, warning: null }
  if (existingId) {
    return { slug: null, warning: `slug "${clean}" is already used by another course (_id ${conflict._id}) — keeping the existing slug` }
  }
  const fallback = `${clean}-${Date.now().toString(36)}`
  return { slug: fallback, warning: `slug "${clean}" is already used by another course (_id ${conflict._id}) — inserting with fallback slug "${fallback}"` }
}

// ---------------------------------------------------------------------------
// Identity resolution (Important #4): scope title matching to the catalogue
// owner first; fall back to an unscoped match only with a printed warning;
// refuse to guess (skip, no write) when a title is ambiguous.
// ---------------------------------------------------------------------------

const emailCache = new Map([[String(owner._id), owner.email]])
async function ownerEmail(instructorId) {
  const key = String(instructorId)
  if (emailCache.has(key)) return emailCache.get(key)
  const user = await db.collection("users").findOne({ _id: instructorId })
  const email = user?.email ?? `unknown user (${key})`
  emailCache.set(key, email)
  return email
}

async function resolveExisting(program) {
  for (const t of [program.title, ...program.legacyTitles]) {
    const dupCount = await db.collection("courses").countDocuments({ title: t })
    if (dupCount > 1) return { kind: "duplicate", title: t, dupCount }

    const ownerMatch = await db.collection("courses").findOne({ title: t, instructor: owner._id })
    if (ownerMatch) return { kind: "match", existing: ownerMatch, matchedOnTitle: t, adopted: false }

    const anyMatch = await db.collection("courses").findOne({ title: t })
    if (anyMatch) return { kind: "match", existing: anyMatch, matchedOnTitle: t, adopted: true }
  }
  return { kind: "none" }
}

// ---------------------------------------------------------------------------
// Plan diff: what a MATCH row's plans would change, field by field (price and
// list price excluded — the price gate and the WARNING block cover those).
// `losses` lists every flag an existing plan has on that the new plan turns off.
// ---------------------------------------------------------------------------

const quoted = (v) => (v == null ? "none" : `"${v}"`)

function diffPlans(current, next) {
  const lines = []
  const losses = []
  for (const plan of next) {
    const cur = current.find((c) => c.key === plan.key)
    if (!cur) {
      lines.push(`plan ${plan.key}: new`)
      continue
    }
    const parts = []
    if (cur.name !== plan.name) parts.push(`name "${cur.name}" -> "${plan.name}"`)
    if (cur.tagline !== plan.tagline) parts.push(`tagline "${cur.tagline}" -> "${plan.tagline}"`)
    if ((cur.duration ?? null) !== (plan.duration ?? null)) parts.push(`duration ${quoted(cur.duration)} -> ${quoted(plan.duration)}`)
    if (Boolean(cur.enabled) !== Boolean(plan.enabled)) parts.push(`enabled ${Boolean(cur.enabled)} -> ${Boolean(plan.enabled)}`)
    const flags = []
    for (const flag of Object.keys(FULL)) {
      const was = Boolean(cur.entitlements?.[flag])
      const now = Boolean(plan.entitlements[flag])
      if (was === now) continue
      flags.push(`${now ? "+" : "-"}${flag}`)
      if (was && !now) losses.push(`${plan.key}.${flag}`)
    }
    if (flags.length > 0) parts.push(flags.join(" "))
    const curFeatures = cur.features ?? []
    if (JSON.stringify(curFeatures) !== JSON.stringify(plan.features)) {
      parts.push(`features rewritten (${curFeatures.length} -> ${plan.features.length} lines)`)
    }
    lines.push(`plan ${plan.key}: ${parts.length > 0 ? parts.join(" · ") : "unchanged"}`)
  }
  return { lines, losses }
}

// ---------------------------------------------------------------------------
// Pass 1 (read-only): resolve every program's plan before printing or
// writing anything, so the WARNING block and the price-change gate below
// can see the whole run up front.
// ---------------------------------------------------------------------------

const counts = { matched: 0, renamed: 0, inserted: 0, skipped: 0, modified: 0, warnings: 0 }
const plans = []

for (const program of PROGRAMS) {
  const school = SCHOOLS[program.school]
  const resolution = await resolveExisting(program)

  if (resolution.kind === "duplicate") {
    plans.push({ program, kind: "skip", title: resolution.title, dupCount: resolution.dupCount })
    continue
  }

  if (resolution.kind === "match") {
    const { existing, matchedOnTitle, adopted } = resolution
    const isRename = matchedOnTitle !== program.title
    const email = adopted ? await ownerEmail(existing.instructor) : owner.email

    const packages = program.buildPackages()
    const derivedPrice = minEnabledPrice(packages)
    const setDoc = {
      title: program.title,
      school: program.school,
      category: school.short,
      packages,
      price: derivedPrice,
      pricing: derivedPrice > 0 ? "paid" : "free",
    }
    const currentLadder = ladderPrices(existing.packages)
    const newLadder = ladderPrices(packages)
    const priceLine = `${derivedPrice} (derived: min enabled package price; existing scalar was ${existing.price})`
    const ladderLine = `${currentLadder} -> ${newLadder}`
    const planDiff = diffPlans(existing.packages ?? [], packages)
    if (program.spec) {
      setDoc.shortDescription = program.spec.shortDescription
      setDoc.description = program.spec.description
      setDoc.whatYouWillLearn = program.spec.whatYouWillLearn
    }

    // A live program keeps its URL: /programs/<slug> links are already shared
    // and indexed, and nothing redirects an old slug. --rename-slugs opts in.
    const slugResult = RENAME_SLUGS
      ? await resolveSlug(program.title, existing._id)
      : { slug: null, warning: null }
    if (slugResult.slug) setDoc.slug = slugResult.slug

    plans.push({
      program, kind: "match", existing, matchedOnTitle, isRename, adopted, ownerEmail: email,
      setDoc, slugResult, priceLine, ladderLine, derivedPrice, currentLadder, newLadder, planDiff,
    })
    continue
  }

  // resolution.kind === "none" — would insert. A pre-existing course already
  // holding the clean slug is a title-drift signal (Important #4d): abort
  // the whole run rather than silently creating a second live copy.
  const cleanSlug = slugify(program.title)
  const slugConflict = await db.collection("courses").findOne({ slug: cleanSlug })
  if (slugConflict) {
    console.error(`\nABORT: slug "${cleanSlug}" exists on "${slugConflict.title}" (_id ${slugConflict._id}) — title drift?`)
    console.error("No documents were written. Investigate before re-running.")
    await mongoose.disconnect()
    process.exit(1)
  }

  const status = program.newInsertDraft ? "draft" : "published"
  const description = program.spec ? program.spec.description : school.blurb
  const shortDescription = program.spec ? program.spec.shortDescription : null
  const whatYouWillLearn = program.spec ? program.spec.whatYouWillLearn : []
  const packages = program.buildPackages()
  const price = minEnabledPrice(packages)
  const priceLine = `${price} (derived: min enabled package price)`
  const newLadder = ladderPrices(packages)

  const now = new Date()
  const doc = {
    title: program.title,
    slug: cleanSlug,
    description,
    shortDescription,
    thumbnailUrl: null,
    thumbnailPublicId: null,
    previewVideoUrl: null,
    instructor: owner._id,
    level: "beginner",
    pricing: price > 0 ? "paid" : "free",
    price,
    currency: "USD",
    status,
    category: school.short,
    school: program.school,
    tags: [],
    totalLessons: 0,
    totalDuration: 0,
    enrolledCount: 0,
    rating: { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    whatYouWillLearn,
    requirements: [],
    targetAudience: [],
    examRequired: false,
    packages,
    publishedAt: status === "published" ? now : null,
    availableAt: null,
    preEnrollEnabled: true,
    liveNotifiedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  plans.push({ program, kind: "insert", doc, priceLine, newLadder })
}

// ---------------------------------------------------------------------------
// WARNING block (Important #3): loud and unmissable, printed before any
// per-program output, in both dry-run and --apply.
// ---------------------------------------------------------------------------

function boxed(lines) {
  const width = Math.max(...lines.map((l) => l.length))
  const bar = `+${"-".repeat(width + 2)}+`
  const body = lines.map((l) => `| ${l}${" ".repeat(width - l.length)} |`)
  return [bar, ...body, bar].join("\n")
}

const usd = (n) => `$${n.toLocaleString("en-US")}`
console.log(
  "\n" +
    boxed([
      "WARNING — price-derivation script",
      "",
      "Every program is set to Owen's three plans (2026-10-28):",
      `  ${["basic", "standard", "executive"].map((k) => `${PLAN[k].label} ${usd(PLAN[k].price)}`).join(" · ")}`,
      "and its scalar price is derived from them (the cheapest enabled plan).",
      "Basic now includes recorded classes, assignments, assessments and the",
      "certificate, but no live classes or instructor Q&A (full access = Executive).",
      "Production runs follow docs/launch-runbook.md §6 (owner-executed).",
      "",
      "Per program: scalar price current -> derived · enabled plan prices current -> new",
      ...plans.map((p) => {
        if (p.kind === "skip") return `  - ${p.program.title}: skipped (duplicate title — no write)`
        if (p.kind === "insert") return `  - ${p.program.title}: (new insert) -> ${p.doc.price} · (new insert) -> ${p.newLadder}`
        return `  - ${p.program.title}: ${p.existing.price} -> ${p.derivedPrice} · ${p.ladderLine}`
      }),
    ])
)

// ---------------------------------------------------------------------------
// Price-change gate (Important #3): refuse to --apply a price change on an
// existing row (mock DBs included) without an explicit flag — a new scalar
// price or new enabled plan prices (what checkout charges). List prices,
// durations and copy are display-only. An idempotent re-run with no pending
// price change never needs it.
// ---------------------------------------------------------------------------

const priceChanges = plans.filter(
  (p) => p.kind === "match" && (p.derivedPrice !== p.existing.price || p.currentLadder !== p.newLadder)
)

if (APPLY && priceChanges.length > 0 && !ALLOW_PRICE_CHANGE) {
  console.error("\nABORT: --apply would change the price of existing course(s) — re-run with --allow-price-change to confirm:")
  for (const p of priceChanges) {
    console.error(`  - ${p.program.title} (_id ${p.existing._id}): price ${p.existing.price} -> ${p.derivedPrice} · plans ${p.ladderLine}`)
  }
  console.error("No documents were written.")
  await mongoose.disconnect()
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Access-loss gate: the packages $set is wholesale, so an existing plan whose
// flag is on (say, granted by hand in the editor) would be switched off for
// every learner on it. Refuse unless the owner has said so in writing.
// ---------------------------------------------------------------------------

const accessLosses = plans.filter((p) => p.kind === "match" && p.planDiff.losses.length > 0)

if (APPLY && accessLosses.length > 0 && !ALLOW_ACCESS_LOSS) {
  console.error("\nABORT: --apply would remove access from existing plan(s) — learners on them would lose it. Re-run with --allow-access-loss only on the owner's written go:")
  for (const p of accessLosses) {
    console.error(`  - ${p.program.title} (_id ${p.existing._id}): ${p.planDiff.losses.join(", ")}`)
  }
  console.error("No documents were written.")
  await mongoose.disconnect()
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Pass 2: print each program's plan (with the operator-identity fields from
// Important #4) and, if --apply, write it.
// ---------------------------------------------------------------------------

for (const plan of plans) {
  const { program } = plan

  if (plan.kind === "skip") {
    console.warn(`\nWARN duplicate title: "${plan.title}" matches ${plan.dupCount} courses — skipping "${program.title}" (no write)`)
    counts.warnings++
    counts.skipped++
    continue
  }

  if (plan.kind === "match") {
    const { existing, matchedOnTitle, isRename, adopted, ownerEmail: email, setDoc, slugResult, priceLine, ladderLine } = plan

    if (adopted) {
      console.warn(`\nWARN adopted row owned by ${email}: "${matchedOnTitle}" (_id ${existing._id}) is not owned by the catalogue owner (${owner.email})`)
      counts.warnings++
    }
    if (slugResult.warning) {
      console.warn(`  WARNING: ${slugResult.warning}`)
      counts.warnings++
    }

    if (isRename) {
      console.log(`\nRENAME ${matchedOnTitle} → ${program.title}`)
      counts.renamed++
    } else {
      console.log(`\nMATCH ${program.title}`)
    }
    counts.matched++
    console.log(`  _id: ${existing._id} · status: ${existing.status} · owner: ${email} · price: ${existing.price}`)
    console.log(`  slug: ${slugResult.slug ? `-> "${slugResult.slug}"` : `unchanged ("${existing.slug}")`}`)
    console.log(`  school: ${existing.school ?? "none"} -> ${program.school}`)
    console.log(`  price: ${priceLine}`)
    console.log(`  plans (enabled prices): ${ladderLine}`)
    for (const line of plan.planDiff.lines) console.log(`  ${line}`)
    console.log(`  $set: ${Object.keys(setDoc).join(", ")}`)

    if (APPLY) {
      const res = await db.collection("courses").updateOne({ _id: existing._id }, { $set: setDoc })
      counts.modified += res.modifiedCount
      console.log(`  modifiedCount: ${res.modifiedCount}`)
    }
    continue
  }

  // plan.kind === "insert"
  const { doc, priceLine, newLadder } = plan
  console.log(`\nINSERT ${program.title}`)
  counts.inserted++
  console.log(`  slug: "${doc.slug}"`)
  console.log(`  price: ${priceLine}, status: ${doc.status}, school: ${program.school}`)
  console.log(`  plans (enabled prices): ${newLadder}`)
  console.log(`  fields: ${Object.keys(doc).join(", ")}`)

  if (APPLY) {
    await db.collection("courses").insertOne(doc)
  }
}

// ---------------------------------------------------------------------------
// Summary: actual outcome, and a sanity check against the expected total
// (Important #4e) — every program must land as exactly one of
// matched/inserted/skipped.
// ---------------------------------------------------------------------------

console.log(`\n${"-".repeat(60)}`)
console.log(`matched ${counts.matched} / renamed ${counts.renamed} / inserted ${counts.inserted} / skipped ${counts.skipped} · warnings: ${counts.warnings}`)
const planned = counts.matched + counts.inserted + counts.skipped
if (planned !== PROGRAMS.length) {
  console.warn(`WARN: planned actions (${planned}) do not add up to the ${PROGRAMS.length} programs defined — investigate before trusting this run`)
}

if (APPLY) {
  console.log(`Inserted ${counts.inserted}`)
  console.log(`Total modifiedCount across matched rows: ${counts.modified}`)
} else {
  console.log("\nDRY RUN — nothing written. Re-run with --apply")
}

await mongoose.disconnect()
