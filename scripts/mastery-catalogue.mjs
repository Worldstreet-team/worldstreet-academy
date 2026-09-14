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
 * On MATCH this $sets title, school, category and packages unconditionally,
 * plus shortDescription/description/whatYouWillLearn only for the 3 programs
 * the spec gives copy for (Forex, Crypto, AI & AI Automation) — every other
 * program's existing copy is left untouched. It never touches thumbnailUrl,
 * status, instructor, enrolledCount or rating on an existing row, and never
 * deletes or archives anything.
 *
 * Price (fix round 1 / controller ruling): the 9 single-package programs
 * keep the original rule — the course's scalar `price` is never overwritten
 * on MATCH, and the one package's price always mirrors it (existing price on
 * MATCH, table price on INSERT). The 3 spec-ladder programs (Forex, Crypto,
 * AI & AI Automation) are different: their packages are a fixed ladder, not
 * derived from the course price, so the course's scalar `price` and
 * `pricing` are DERIVED from the packages instead — `price` = the cheapest
 * *enabled* package price, `pricing` = "paid" — and that derivation is
 * $set on MATCH too (so an old row inserted with the wrong scalar price
 * self-heals). Forex/Crypto resolve to 49 (their `basic` package); AI & AI
 * Automation resolves to 199 (its only package).
 *
 * Slug: if the clean slugify(title) isn't held by any *other* course, it is
 * $set; otherwise the existing slug is kept and a warning is printed.
 *
 * updatedAt is deliberately NOT bumped on a no-op $set (raw collection
 * writes bypass Mongoose's timestamps middleware anyway) — bumping it on
 * every idempotent re-run would make modifiedCount nonzero forever and
 * break the idempotency check the brief requires.
 */
import mongoose from "mongoose"
import { config } from "dotenv"
config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")

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

function pkg(key, name, tagline, price, features, entitlements, { highlight = false, ctaLabel = null, enabled = true } = {}) {
  return { key, name, tagline, price, features, highlight, ctaLabel, enabled, entitlements }
}

function genericPackage(price) {
  return [pkg("standard", "Full program", "", price, [], FULL)]
}

/** Course-level price for the 3 spec-ladder programs: the cheapest enabled package. */
function minEnabledPrice(packages) {
  const enabled = packages.filter((p) => p.enabled)
  if (enabled.length === 0) throw new Error("minEnabledPrice: no enabled packages to derive a price from")
  return Math.min(...enabled.map((p) => p.price))
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
const FOREX_EXECUTIVE_FEATURES = [
  "Everything in Standard", "Private 1-on-1 coaching", "Personalized learning roadmap", "Private expert sessions",
  "Individual strategy review", "Personalized trading-plan development", "Private Q&A", "Direct mentorship",
  "Individual progress assessment", "Personalized feedback", "Priority support",
]
const forexPackages = [
  pkg("basic", "Forex Foundation", "Perfect for beginners", 49, FOREX_BASIC_FEATURES, NONE),
  pkg("standard", "Forex Mastery", "Designed for learners who want a comprehensive Forex education pathway.", 199, FOREX_STANDARD_FEATURES, STANDARD_TIER, { highlight: true }),
  pkg("executive", "Private Forex Mentorship", "A premium one-on-one learning experience.", 999, FOREX_EXECUTIVE_FEATURES, FULL, { ctaLabel: "Apply / Enrol for $999" }),
]

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
const cryptoPackages = [
  pkg("basic", "Crypto Foundation", "Perfect for beginners", 49, CRYPTO_BASIC_FEATURES, NONE),
  // Standard/executive share Forex's features & entitlements verbatim (brief: "identical to Forex Standard/Executive").
  pkg("standard", "Crypto Mastery", "Designed for learners who want a comprehensive crypto education pathway.", 199, FOREX_STANDARD_FEATURES, STANDARD_TIER, { highlight: true }),
  pkg("executive", "Private 1-on-1 Crypto Mentorship", "A premium one-on-one learning experience.", 999, FOREX_EXECUTIVE_FEATURES, FULL, { ctaLabel: "Apply / Enrol for $999" }),
]

const AI_WYL = [
  "AI fundamentals", "Prompt engineering", "AI productivity tools", "Content automation",
  "Business automation", "Workflow design", "AI-assisted research", "AI for marketing",
  "AI for productivity", "Building automated workflows",
]
const aiPackages = [
  pkg("standard", "Founding price", "", 199, AI_WYL, FULL),
]

// ---------------------------------------------------------------------------
// The 12 programs (title -> school slug, table price).
// ---------------------------------------------------------------------------

const PROGRAMS = [
  {
    // No table `price` here: price is derived from the packages (min enabled) — see derivePriceFromPackages below.
    title: "Forex Trading Mastery", legacyTitles: [], school: "trading-financial-markets", derivePriceFromPackages: true,
    newInsertDraft: false,
    spec: {
      shortDescription: "Learn the fundamentals and advanced concepts of Forex trading through a structured learning pathway.",
      description: "Want to understand how the Forex market works? Want to stop relying on random information and start developing a structured understanding of the market? The Forex Trading Mastery program is designed to take you through a structured learning journey—from foundational concepts to advanced market analysis and trading principles.",
      whatYouWillLearn: FOREX_WYL,
    },
    buildPackages: () => forexPackages,
  },
  {
    title: "Crypto Trading Mastery", legacyTitles: [], school: "trading-financial-markets", derivePriceFromPackages: true,
    newInsertDraft: false,
    spec: {
      shortDescription: "Understand digital assets, crypto markets, analysis, security and responsible trading principles.",
      description: "Cryptocurrency has created an entirely new financial and technological ecosystem. But entering the crypto market without proper knowledge can expose you to unnecessary risk. Our Crypto Trading Mastery program is designed to help you understand digital assets, market dynamics, analysis, risk management and responsible trading practices.",
      whatYouWillLearn: CRYPTO_WYL,
    },
    buildPackages: () => cryptoPackages,
  },
  {
    title: "Blockchain Technology Mastery", legacyTitles: [], school: "blockchain-web3", price: 99,
    newInsertDraft: false, spec: null, buildPackages: genericPackage,
  },
  {
    title: "AI & AI Automation", legacyTitles: ["Artificial Intelligence & AI Automation"], school: "ai-automation", derivePriceFromPackages: true,
    newInsertDraft: false,
    spec: {
      shortDescription: "Turn Artificial Intelligence into a practical skill.",
      description: "AI isn't just changing technology. It's changing how businesses operate, how people work and how opportunities are created. This program introduces you to practical AI tools, automation workflows and real-world applications.",
      whatYouWillLearn: AI_WYL,
    },
    buildPackages: () => aiPackages,
  },
  {
    title: "App Development with AI", legacyTitles: [], school: "software-app-development", price: 49,
    newInsertDraft: false, spec: null, buildPackages: genericPackage,
  },
  {
    title: "Cybersecurity", legacyTitles: [], school: "cybersecurity", price: 99,
    newInsertDraft: false, spec: null, buildPackages: genericPackage,
  },
  {
    title: "Data Analysis", legacyTitles: [], school: "data-analytics", price: 99,
    newInsertDraft: false, spec: null, buildPackages: genericPackage,
  },
  {
    title: "Content Creation Mastery", legacyTitles: ["Content Creation / Video Editing Mastery"], school: "digital-media-creative", price: 99,
    newInsertDraft: false, spec: null, buildPackages: genericPackage,
  },
  {
    title: "Video Editing Mastery", legacyTitles: [], school: "digital-media-creative", price: 99,
    newInsertDraft: true, spec: null, buildPackages: genericPackage,
  },
  {
    title: "Tech Sales & Digital Marketing", legacyTitles: [], school: "digital-business-remote-careers", price: 49,
    newInsertDraft: false, spec: null, buildPackages: genericPackage,
  },
  {
    title: "E-Commerce & Digital Business", legacyTitles: [], school: "digital-business-remote-careers", price: 49,
    newInsertDraft: true, spec: null, buildPackages: genericPackage,
  },
  {
    title: "Virtual Assistance", legacyTitles: [], school: "digital-business-remote-careers", price: 49,
    newInsertDraft: false, spec: null, buildPackages: genericPackage,
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
// Per-program plan + (optionally) write.
// ---------------------------------------------------------------------------

const counts = { matched: 0, renamed: 0, inserted: 0, modified: 0, warnings: 0 }

for (const program of PROGRAMS) {
  const school = SCHOOLS[program.school]
  const titleCandidates = [program.title, ...program.legacyTitles]

  let existing = null
  let matchedOnTitle = null
  for (const t of titleCandidates) {
    existing = await db.collection("courses").findOne({ title: t })
    if (existing) {
      matchedOnTitle = t
      break
    }
  }

  if (existing) {
    const isRename = matchedOnTitle !== program.title
    const packages = program.buildPackages(existing.price)
    const setDoc = {
      title: program.title,
      school: program.school,
      category: school.short,
      packages,
    }
    let priceLine
    if (program.derivePriceFromPackages) {
      const derivedPrice = minEnabledPrice(packages)
      setDoc.price = derivedPrice
      setDoc.pricing = "paid"
      priceLine = `${derivedPrice} (derived: min enabled package price; existing scalar was ${existing.price})`
    } else {
      priceLine = `unchanged (${existing.price})`
    }
    if (program.spec) {
      setDoc.shortDescription = program.spec.shortDescription
      setDoc.description = program.spec.description
      setDoc.whatYouWillLearn = program.spec.whatYouWillLearn
    }

    const slugResult = await resolveSlug(program.title, existing._id)
    if (slugResult.slug) setDoc.slug = slugResult.slug
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
    console.log(`  slug: ${slugResult.slug ? `-> "${slugResult.slug}"` : `unchanged ("${existing.slug}")`}`)
    console.log(`  price: ${priceLine}`)
    console.log(`  $set: ${Object.keys(setDoc).join(", ")}`)

    if (APPLY) {
      const res = await db.collection("courses").updateOne({ _id: existing._id }, { $set: setDoc })
      counts.modified += res.modifiedCount
      console.log(`  modifiedCount: ${res.modifiedCount}`)
    }
  } else {
    const status = program.newInsertDraft ? "draft" : "published"
    const description = program.spec ? program.spec.description : school.blurb
    const shortDescription = program.spec ? program.spec.shortDescription : null
    const whatYouWillLearn = program.spec ? program.spec.whatYouWillLearn : []
    const packages = program.buildPackages(program.price)
    const price = program.derivePriceFromPackages ? minEnabledPrice(packages) : program.price
    const priceLine = program.derivePriceFromPackages ? `${price} (derived: min enabled package price)` : `${price} (table)`

    const slugResult = await resolveSlug(program.title, null)
    if (slugResult.warning) {
      console.warn(`  WARNING: ${slugResult.warning}`)
      counts.warnings++
    }

    const now = new Date()
    const doc = {
      title: program.title,
      slug: slugResult.slug,
      description,
      shortDescription,
      thumbnailUrl: null,
      thumbnailPublicId: null,
      previewVideoUrl: null,
      instructor: owner._id,
      level: "beginner",
      pricing: "paid",
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

    console.log(`\nINSERT ${program.title}`)
    counts.inserted++
    console.log(`  slug: "${slugResult.slug}"`)
    console.log(`  price: ${priceLine}, status: ${status}, school: ${program.school}`)
    console.log(`  fields: ${Object.keys(doc).join(", ")}`)

    if (APPLY) {
      await db.collection("courses").insertOne(doc)
    }
  }
}

console.log(`\n${"-".repeat(60)}`)
console.log(`Matched: ${counts.matched} (renamed: ${counts.renamed}) · Inserted: ${counts.inserted} · Warnings: ${counts.warnings}`)

if (APPLY) {
  console.log(`Inserted ${counts.inserted}`)
  console.log(`Total modifiedCount across matched rows: ${counts.modified}`)
} else {
  console.log("\nDRY RUN — nothing written. Re-run with --apply")
}

await mongoose.disconnect()
