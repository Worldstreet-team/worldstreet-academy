/**
 * Install/update the 12 WorldStreet Mastery Academy programs (title, school,
 * spec copy, packages) into the `courses` collection. Idempotent: re-running
 * with --apply after a clean run reports 0 modifications.
 *
 *   node scripts/mastery-catalogue.mjs           # dry run — prints the plan
 *   node scripts/mastery-catalogue.mjs --apply   # writes
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
 * unconditionally, plus shortDescription/description/whatYouWillLearn only
 * for the 3 programs the spec gives copy for (Forex, Crypto, AI & AI
 * Automation) — every other program's existing copy is left untouched. It
 * never touches thumbnailUrl, status, instructor, enrolledCount or rating on
 * an existing row, and never deletes or archives anything.
 *
 * Plans (owner meeting, 2026-10-03): every one of the 12 programs sells the
 * same three plans — Basic $49 (was $300), Standard $199 (was $1,000, the
 * highlighted "most popular") and Executive $999 (was $10,000: private
 * one-on-one teaching with a personal tutor, lifetime mentorship, the signal
 * group). `price` is what checkout charges; `listPrice` is the original,
 * shown struck through until the live cohort starts (lib/cohort.ts).
 * Durations: Standard and Executive "9 weeks"; Basic null until the owner
 * confirms it. Entitlements follow the Forex ladder (Basic NONE, Standard
 * STANDARD_TIER, Executive FULL). Forex and Crypto keep their spec feature
 * lists; the other 10 get one generic list per plan, named after the
 * program's subject. Every Executive plan lists the owner's three promises
 * (EXECUTIVE_PROMISE).
 *
 * Price: every program's scalar `price` and `pricing` are DERIVED from its
 * plans — `price` = the cheapest *enabled* plan (49, Basic), `pricing` =
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
 *   becomes Basic 49 (no live classes, Q&A, assignments or certificate),
 *   Standard 199 and Executive 999 (full access) — see the boxed WARNING printed
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
  "blockchain-web3": {
    short: "Blockchain & Web3",
    blurb: "Understand the technology behind blockchain, digital assets and the emerging Web3 economy.",
  },
  "ai-automation": {
    short: "AI & Automation",
    blurb: "Discover how AI is transforming business, productivity, creativity and everyday work.",
  },
  "software-app-development": {
    short: "Software & App Development",
    blurb: "Learn how modern applications are designed and developed, including the use of AI-powered development tools.",
  },
  cybersecurity: {
    short: "Cybersecurity",
    blurb: "Build knowledge of digital security, cyber threats and responsible cybersecurity practices.",
  },
  "data-analytics": {
    short: "Data & Analytics",
    blurb: "Learn how to collect, understand, analyze and communicate data for better decisions.",
  },
  "digital-media-creative": {
    short: "Digital Media & Creative Technology",
    blurb: "Turn ideas into compelling digital content and develop skills for the creator economy.",
  },
  "digital-business-remote-careers": {
    short: "Digital Business & Remote Careers",
    blurb: "Build practical skills for selling, marketing, e-commerce and working in the global digital economy.",
  },
}

// ---- duplicated from lib/db/models/course.ts (ICoursePackage / IPackageEntitlements) ----
const FULL = { liveClasses: true, instructorQa: true, assignments: true, certificate: true, mentorship: true, prioritySupport: true }
const NONE = { liveClasses: false, instructorQa: false, assignments: false, certificate: false, mentorship: false, prioritySupport: false }
// Standard-tier ladder rung: live classes + Q&A + assignments + certificate, no mentorship/priority support.
const STANDARD_TIER = { liveClasses: true, instructorQa: true, assignments: true, certificate: true, mentorship: false, prioritySupport: false }

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

/** "49/199/999" — a row's enabled package prices in ladder order; "none" when it sells none. */
function ladderPrices(packages) {
  const enabled = (packages ?? [])
    .filter((p) => p.enabled !== false)
    .sort((a, b) => (RANK[a.key] ?? 9) - (RANK[b.key] ?? 9))
  return enabled.length > 0 ? enabled.map((p) => p.price).join("/") : "none"
}

// ---------------------------------------------------------------------------
// The three plans every program sells (owner meeting, 2026-10-03). `price`
// is the launch "pay now" price checkout charges; `listPrice` the original,
// struck through on the program page until the live cohort starts.
// Basic's duration is null until the owner confirms it.
// ---------------------------------------------------------------------------

const PLAN = {
  basic: { label: "Basic", price: 49, listPrice: 300, duration: null, entitlements: NONE, highlight: false, ctaLabel: null },
  standard: { label: "Standard", price: 199, listPrice: 1000, duration: "9 weeks", entitlements: STANDARD_TIER, highlight: true, ctaLabel: null },
  executive: { label: "Executive", price: 999, listPrice: 10000, duration: "9 weeks", entitlements: FULL, highlight: false, ctaLabel: "Apply / Enrol for $999" },
}

/** What the owner promises on every Executive plan. */
const EXECUTIVE_PROMISE = [
  "Private one-on-one classes with a personal tutor",
  "Lifetime mentorship access",
  "Access to the signal group",
]

/** A program's three plans from its copy: `{ basic, standard, executive }`, each `{ name, tagline, features }`. */
function ladder(copy) {
  return ["basic", "standard", "executive"].map((key) => {
    const plan = PLAN[key]
    const { name, tagline, features } = copy[key]
    return pkg(key, name, tagline, plan.price, features, plan.entitlements, {
      highlight: plan.highlight,
      ctaLabel: plan.ctaLabel,
      listPrice: plan.listPrice,
      duration: plan.duration,
    })
  })
}

/** Plan copy for a program the spec gives none for — one generic list per plan, named after its subject. */
function genericLadder(subject) {
  return ladder({
    basic: {
      name: `${subject} Foundation`,
      tagline: "Perfect for beginners",
      features: [
        `${subject} fundamentals`, "Core concepts & terminology", "Self-paced video lessons",
        "Practical examples", "Learning materials", "Community access where applicable",
      ],
    },
    standard: {
      name: `${subject} Mastery`,
      tagline: "Designed for learners who want a comprehensive, guided learning pathway.",
      features: [
        "Everything in Basic", "The complete program curriculum", "Advanced concepts & techniques",
        "Real-world application", "Practical assignments", "Live classes where scheduled", "Instructor Q&A",
        "Assessment & certificate",
      ],
    },
    executive: {
      name: `Private ${subject} Mentorship`,
      tagline: "A premium one-on-one learning experience.",
      features: [
        "Everything in Standard", ...EXECUTIVE_PROMISE, "Personalized learning roadmap",
        "Individual progress assessment", "Personalized feedback", "Priority support",
      ],
    },
  })
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
const FOREX_BASIC_FEATURES = [
  "Forex fundamentals", "Currency pairs", "Market terminology", "Charts & candlesticks",
  "Introduction to technical analysis", "Market structure fundamentals", "Risk-management foundations",
  "Trading psychology fundamentals", "Learning materials", "Community access where applicable",
]
const FOREX_STANDARD_FEATURES = [
  "Everything in Basic", "Advanced technical analysis", "Fundamental analysis", "Trading strategy frameworks",
  "Trade planning", "Execution principles", "Advanced risk management", "Trading psychology",
  "Practical assignments", "Live classes where scheduled", "Instructor Q&A",
  "Mentorship/community support where included", "Educational market-analysis sessions where scheduled",
  "Assessment & certificate",
]
// The owner's three Executive promises lead the list; the first replaces the
// spec's "Private 1-on-1 coaching", which says the same thing.
const FOREX_EXECUTIVE_FEATURES = [
  "Everything in Standard", ...EXECUTIVE_PROMISE, "Personalized learning roadmap", "Private expert sessions",
  "Individual strategy review", "Personalized trading-plan development", "Private Q&A", "Direct mentorship",
  "Individual progress assessment", "Personalized feedback", "Priority support",
]
const forexPackages = ladder({
  basic: { name: "Forex Foundation", tagline: "Perfect for beginners", features: FOREX_BASIC_FEATURES },
  standard: { name: "Forex Mastery", tagline: "Designed for learners who want a comprehensive Forex education pathway.", features: FOREX_STANDARD_FEATURES },
  executive: { name: "Private Forex Mentorship", tagline: "A premium one-on-one learning experience.", features: FOREX_EXECUTIVE_FEATURES },
})

const CRYPTO_WYL = [
  "Cryptocurrency fundamentals", "Bitcoin & digital assets", "Blockchain fundamentals", "Exchanges & wallets",
  "Market structure", "Technical analysis", "Fundamental analysis", "Trading strategies", "Risk management",
  "Trading psychology", "Portfolio principles", "Crypto security", "Practical market analysis",
]
const CRYPTO_BASIC_FEATURES = [
  "Cryptocurrency fundamentals", "Bitcoin & digital assets", "Blockchain fundamentals", "Exchanges & wallets",
  "Market structure", "Introduction to technical analysis", "Risk-management foundations", "Crypto security",
  "Learning materials", "Community access where applicable",
]
const cryptoPackages = ladder({
  basic: { name: "Crypto Foundation", tagline: "Perfect for beginners", features: CRYPTO_BASIC_FEATURES },
  // Standard/executive share Forex's features & entitlements verbatim (brief: "identical to Forex Standard/Executive").
  standard: { name: "Crypto Mastery", tagline: "Designed for learners who want a comprehensive crypto education pathway.", features: FOREX_STANDARD_FEATURES },
  executive: { name: "Private 1-on-1 Crypto Mentorship", tagline: "A premium one-on-one learning experience.", features: FOREX_EXECUTIVE_FEATURES },
})

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
    title: "Blockchain Technology Mastery", legacyTitles: [], school: "blockchain-web3",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Blockchain"),
  },
  {
    title: "AI & AI Automation", legacyTitles: ["Artificial Intelligence & AI Automation"], school: "ai-automation",
    newInsertDraft: false,
    spec: {
      shortDescription: "Turn Artificial Intelligence into a practical skill.",
      description: "AI isn't just changing technology. It's changing how businesses operate, how people work and how opportunities are created. This program introduces you to practical AI tools, automation workflows and real-world applications.",
      whatYouWillLearn: AI_WYL,
    },
    buildPackages: () => genericLadder("AI"),
  },
  {
    title: "App Development with AI", legacyTitles: [], school: "software-app-development",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("App Development"),
  },
  {
    title: "Cybersecurity", legacyTitles: [], school: "cybersecurity",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Cybersecurity"),
  },
  {
    title: "Data Analysis", legacyTitles: [], school: "data-analytics",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Data Analysis"),
  },
  {
    title: "Content Creation Mastery", legacyTitles: ["Content Creation / Video Editing Mastery"], school: "digital-media-creative",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Content Creation"),
  },
  {
    title: "Video Editing Mastery", legacyTitles: [], school: "digital-media-creative",
    newInsertDraft: true, spec: null, buildPackages: () => genericLadder("Video Editing"),
  },
  {
    title: "Tech Sales & Digital Marketing", legacyTitles: [], school: "digital-business-remote-careers",
    newInsertDraft: false, spec: null, buildPackages: () => genericLadder("Tech Sales & Marketing"),
  },
  {
    title: "E-Commerce & Digital Business", legacyTitles: [], school: "digital-business-remote-careers",
    newInsertDraft: true, spec: null, buildPackages: () => genericLadder("E-Commerce"),
  },
  {
    title: "Virtual Assistance", legacyTitles: [], school: "digital-business-remote-careers",
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
      setDoc, slugResult, priceLine, ladderLine, derivedPrice, currentLadder, newLadder,
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
      "Every program is set to the owner's three plans (2026-10-03):",
      `  ${["basic", "standard", "executive"].map((k) => `${PLAN[k].label} ${usd(PLAN[k].price)} (was ${usd(PLAN[k].listPrice)})`).join(" · ")}`,
      "and its scalar price is derived from them (the cheapest enabled plan).",
      "Programs that sold one full-access package now start at Basic, which has",
      "no live classes, Q&A, assignments or certificate (full access = Executive).",
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
    console.log(`  price: ${priceLine}`)
    console.log(`  plans (enabled prices): ${ladderLine}`)
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
