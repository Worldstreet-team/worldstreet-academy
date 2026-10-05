/**
 * Install the New Economy courses (owner meeting, 2026-10-03): one FREE
 * course per WorldStreet product, explaining how to use it. They land as
 * DRAFTS for the team to fill with lessons and publish from the editor.
 *
 *   node scripts/new-economy-catalogue.mjs --owner <admin email>                          # dry run
 *   MONGODB_URI=<uri> node scripts/new-economy-catalogue.mjs --owner <admin email> --apply  # writes
 *
 * Modeled on scripts/mastery-catalogue.mjs (dotenv, raw db.collection
 * writes, an --apply gate). What it does:
 *   - INSERT a missing course as a draft: kind "new-economy", pricing "free",
 *     price 0, no packages, owned by the --owner ADMIN.
 *   - On MATCH (same title, kind "new-economy") $set only what makes it a
 *     New Economy course — kind, free pricing, no packages, school/category —
 *     and the one-line copy. Never status, owner, lessons, art or counters.
 * It NEVER publishes, never unpublishes and never deletes. Idempotent: a
 * re-run after a clean run reports 0 modifications.
 *
 * The products are the WorldStreet hub's NAV_GROUPS apps, the same list the
 * student sidebar's "WorldStreet" group mirrors. Duplicated literally from
 * the app's TS (a .mjs script can't import it):
 *   - lib/db/models/course.ts   (Course fields, CourseKind, the review default)
 *   - lib/brand.ts              (BRAND.name)
 *
 * SAFETY: .env.local holds the PRODUCTION URI. A dry run may read it; --apply
 * refuses unless MONGODB_URI was set on the command line. Raw collection
 * writes don't bump updatedAt on a no-op $set, like mastery-catalogue.mjs.
 */
import mongoose from "mongoose"
import { config } from "dotenv"

// Read BEFORE dotenv runs: dotenv never overrides a variable that is already
// set, so this is non-empty only when the operator passed the URI explicitly.
const EXPLICIT_URI = process.env.MONGODB_URI
config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")
const ownerFlag = process.argv.indexOf("--owner")
const OWNER_EMAIL = ownerFlag > -1 ? process.argv[ownerFlag + 1]?.trim().toLowerCase() : null

if (!OWNER_EMAIL || OWNER_EMAIL.startsWith("--")) {
  console.error("Usage: node scripts/new-economy-catalogue.mjs --owner <admin email> [--apply]")
  process.exit(1)
}

if (APPLY && !EXPLICIT_URI) {
  console.error("REFUSING --apply: MONGODB_URI must be passed on the command line; a URI from .env files is never written to.")
  console.error("  MONGODB_URI=<uri> node scripts/new-economy-catalogue.mjs --owner <admin email> --apply")
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set — refusing to run.")
  process.exit(1)
}

const BRAND_NAME = "WorldStreet Mastery Academy" // lib/brand.ts BRAND.name
const CATEGORY = "New Economy"

/** One course per product, in the hub's order. `line` is the card blurb (≤ 200 chars). */
const COURSES = [
  {
    product: "Dashboard",
    title: "How to use the WorldStreet Dashboard",
    line: "Find your way around the WorldStreet dashboard: your account, your apps and where everything lives.",
  },
  {
    product: "Wallet",
    title: "How to use the WorldStreet Wallet",
    line: "Fund, hold and move money in your WorldStreet wallet — and keep it safe.",
  },
  {
    product: "Shop",
    title: "How to use WorldStreet Shop",
    line: "Shop on WorldStreet, from finding a product and paying to tracking your order.",
  },
  {
    product: "Social",
    title: "How to use WorldStreet Social",
    line: "Set up your WorldStreet Social profile, follow people and join the conversation.",
  },
  {
    product: "Xstream",
    title: "How to use Xstream",
    line: "A guided tour of Xstream: finding streams, following creators and going live yourself.",
  },
  {
    product: "Forex Trading",
    title: "How to use WorldStreet Forex Trading",
    line: "Open the WorldStreet forex platform, read the screen and place your first practice trade.",
  },
  {
    product: "Vivid AI",
    title: "How to use Vivid AI",
    line: "Put Vivid AI, WorldStreet's assistant, to work — ask, plan and get things done by voice or text.",
  },
  {
    product: "Vision",
    title: "How to use WorldStreet Vision",
    line: "A guided tour of WorldStreet Vision: what it does and how to start using it.",
  },
  {
    product: "Arcade",
    title: "How to use WorldStreet Arcade",
    line: "Play and compete on WorldStreet Arcade: the games, the rules and how rewards work.",
  },
  {
    product: "Prediction",
    title: "How to use WorldStreet Prediction",
    line: "How WorldStreet Prediction works: reading a market, making a forecast and how results settle.",
  },
]

for (const c of COURSES) {
  if (c.line.length > 200) throw new Error(`"${c.title}": the line is over 200 characters (Course.shortDescription maxlength)`)
}

const description = (line) =>
  `${line} A free New Economy course from ${BRAND_NAME}: short lessons, at your own pace.`

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")

await mongoose.connect(uri)
const db = mongoose.connection.db
const courses = db.collection("courses")
console.log(
  `Target: ${uri.replace(/\/\/[^@/]+@/, "//***@")} · database ${db.databaseName} · URI from ${EXPLICIT_URI ? "command line" : ".env file"}`
)
console.log(`Mode: ${APPLY ? "APPLY" : "dry run"}`)

const owner = await db.collection("users").findOne({ email: OWNER_EMAIL })
if (!owner) {
  console.error(`No user with email ${OWNER_EMAIL}.`)
  await mongoose.disconnect()
  process.exit(1)
}
if (owner.role !== "ADMIN") {
  console.error(`${OWNER_EMAIL} is ${owner.role ?? "no role"}, not ADMIN — New Economy courses are the Academy's own. Refusing.`)
  await mongoose.disconnect()
  process.exit(1)
}
console.log(`Owner for inserts: ${owner.email} (${owner._id})`)

const counts = { matched: 0, inserted: 0, skipped: 0, modified: 0, warnings: 0 }

for (const course of COURSES) {
  const existing = await courses.find({ title: course.title }).toArray()
  const ours = existing.filter((row) => row.kind === "new-economy")

  if (ours.length > 1) {
    console.warn(`\nWARN duplicate: "${course.title}" matches ${ours.length} New Economy courses — skipping (no write)`)
    counts.warnings++
    counts.skipped++
    continue
  }
  if (ours.length === 0 && existing.length > 0) {
    // Same title on a program or marketplace course: never adopt it.
    console.warn(`\nWARN "${course.title}" exists as a ${existing[0].kind ?? "program"} course (_id ${existing[0]._id}) — skipping (no write)`)
    counts.warnings++
    counts.skipped++
    continue
  }

  if (ours.length === 1) {
    const row = ours[0]
    const setDoc = {
      kind: "new-economy",
      pricing: "free",
      price: 0,
      packages: [],
      school: null,
      category: CATEGORY,
      shortDescription: course.line,
    }
    const changed = Object.keys(setDoc).filter((key) => JSON.stringify(row[key] ?? null) !== JSON.stringify(setDoc[key]))
    console.log(`\nMATCH ${course.title}`)
    console.log(`  _id: ${row._id} · status: ${row.status} (left as is) · price: ${row.price}`)
    console.log(`  $set: ${changed.length > 0 ? changed.join(", ") : "nothing to change"}`)
    counts.matched++
    if (APPLY && changed.length > 0) {
      const res = await courses.updateOne({ _id: row._id }, { $set: setDoc })
      counts.modified += res.modifiedCount
      console.log(`  modifiedCount: ${res.modifiedCount}`)
    }
    continue
  }

  let slug = slugify(course.title)
  const slugTaken = await courses.findOne({ slug })
  if (slugTaken) {
    const fallback = `${slug}-${Date.now().toString(36)}`
    console.warn(`  WARN slug "${slug}" is used by "${slugTaken.title}" (_id ${slugTaken._id}) — inserting as "${fallback}"`)
    counts.warnings++
    slug = fallback
  }

  const now = new Date()
  const doc = {
    title: course.title,
    slug,
    description: description(course.line),
    shortDescription: course.line,
    thumbnailUrl: null,
    thumbnailPublicId: null,
    previewVideoUrl: null,
    instructor: owner._id,
    level: "beginner",
    pricing: "free",
    price: 0,
    currency: "USD",
    status: "draft",
    category: CATEGORY,
    school: null,
    tags: [course.product],
    totalLessons: 0,
    totalDuration: 0,
    enrolledCount: 0,
    rating: { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    whatYouWillLearn: [],
    requirements: [],
    targetAudience: [],
    examRequired: false,
    packages: [],
    kind: "new-economy",
    review: { status: "none", submittedAt: null, reviewedAt: null, reviewedBy: null, note: null },
    communityUrl: null,
    publishedAt: null,
    availableAt: null,
    preEnrollEnabled: true,
    liveNotifiedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  console.log(`\nINSERT ${course.title}`)
  console.log(`  slug: "${doc.slug}" · status: draft · free · owner: ${owner.email}`)
  counts.inserted++
  if (APPLY) await courses.insertOne(doc)
}

console.log(`\n${"-".repeat(60)}`)
console.log(`matched ${counts.matched} / inserted ${counts.inserted} / skipped ${counts.skipped} · warnings: ${counts.warnings}`)
if (APPLY) {
  console.log(`Inserted ${counts.inserted} draft(s) · modifiedCount across matched rows: ${counts.modified}`)
  console.log("Nothing was published: add lessons, then publish each course from the editor.")
} else {
  console.log("\nDRY RUN — nothing written. Re-run with MONGODB_URI=<uri> ... --apply")
}

await mongoose.disconnect()
