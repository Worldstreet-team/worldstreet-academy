/**
 * Move stored school slugs to the seven schools (WorldStreet Mastery Academy,
 * Phase 13, D21).
 *
 * The institutional blueprint (§7) replaces the eight schools with seven. Four
 * old schools merge into "technology-ai", and three are renamed. This rewrites
 * the stored values so the data matches lib/schools.ts. Until it runs, the web
 * already reads a retired slug as its new school (schoolFromSlug), so deploy
 * order can't strand a program.
 *
 *   MONGODB_URI=<uri> node scripts/migrate-schools-v2.mjs           # dry run
 *   MONGODB_URI=<uri> node scripts/migrate-schools-v2.mjs --apply   # writes
 *
 * Rewritten: courses.school (and courses.category, on moved courses only),
 * enrollmentintents.school, sellerapplications.school and
 * instructorapplications.answers.school. The maps below are duplicated
 * literally from lib/schools.ts (each school's `legacySlugs` and `short`); a
 * .mjs script can't import the app's TS, so keep them equal.
 *
 * Idempotent: a re-run finds nothing to move. It never deletes. Each write
 * matches the old value, so a row changed mid-run is skipped, not overwritten.
 * A value that was never a school is reported as a LEFTOVER and left alone.
 * Raw collection writes, like scripts/mastery-catalogue.mjs, don't bump
 * updatedAt.
 *
 * Run it right after deploying Phase 13. Never run a pre-Phase 13
 * mastery-catalogue.mjs after it: that would move the programs back.
 *
 * SAFETY: .env.local holds the PRODUCTION URI. A dry run may read it; --apply
 * refuses unless MONGODB_URI was set on the command line.
 */
import mongoose from "mongoose"
import { config } from "dotenv"

// Read BEFORE dotenv runs: dotenv never overrides a variable that is already
// set, so this is non-empty only when the operator passed the URI explicitly.
const EXPLICIT_URI = process.env.MONGODB_URI
config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")

// Duplicated literally from lib/schools.ts (each school's `legacySlugs` and `short`).
const MOVES = {
  "ai-automation": "technology-ai", "software-app-development": "technology-ai", cybersecurity: "technology-ai",
  "data-analytics": "technology-ai", "digital-business-remote-careers": "digital-business",
  "digital-media-creative": "creative-economy", "blockchain-web3": "emerging-technologies",
}
const SHORT = {
  "trading-financial-markets": "Trading & Financial Markets", "technology-ai": "Technology & AI",
  "digital-business": "Digital Business", "entrepreneurship-wealth-creation": "Entrepreneurship & Wealth Creation",
  "creative-economy": "Creative Economy", "leadership-personal-development": "Leadership & Personal Development",
  "emerging-technologies": "Emerging Technologies",
}
const TARGETS = [
  { collection: "courses", field: "school", extra: (next) => ({ category: SHORT[next] }) },
  { collection: "enrollmentintents", field: "school", extra: () => ({}) },
  { collection: "sellerapplications", field: "school", extra: () => ({}) },
  { collection: "instructorapplications", field: "answers.school", extra: () => ({}) },
]

if (APPLY && !EXPLICIT_URI) {
  console.error("REFUSING --apply: MONGODB_URI must be passed on the command line; a URI from .env files is never written to.")
  console.error("  MONGODB_URI=<uri> node scripts/migrate-schools-v2.mjs --apply")
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set — refusing to run.")
  process.exit(1)
}

await mongoose.connect(uri)
const db = mongoose.connection.db
console.log(
  `Target: ${uri.replace(/\/\/[^@/]+@/, "//***@")} · database ${db.databaseName} · URI from ${EXPLICIT_URI ? "command line" : ".env file"}`
)
console.log(`Mode: ${APPLY ? "APPLY" : "dry run"}`)

/** Read a dotted field ("answers.school") from a document. */
function get(doc, path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), doc)
}

let moved = 0
let skipped = 0
let leftovers = 0

for (const { collection, field, extra } of TARGETS) {
  const col = db.collection(collection)
  const docs = await col
    .find({ [field]: { $in: Object.keys(MOVES) } }, { projection: { _id: 1, [field]: 1 } })
    .toArray()
  const counts = new Map()

  for (const doc of docs) {
    const old = get(doc, field)
    const next = MOVES[old]
    const key = `${old} → ${next}`
    if (!APPLY) {
      console.log(`WOULD MOVE ${collection}.${field} ${doc._id} ${old} → ${next}`)
      counts.set(key, (counts.get(key) ?? 0) + 1)
      moved++
      continue
    }
    const res = await col.updateOne({ _id: doc._id, [field]: old }, { $set: { [field]: next, ...extra(next) } })
    if (res.modifiedCount === 1) {
      console.log(`MOVED ${collection}.${field} ${doc._id} ${old} → ${next}`)
      counts.set(key, (counts.get(key) ?? 0) + 1)
      moved++
    } else {
      console.log(`SKIP ${collection} ${doc._id} · changed while running`)
      skipped++
    }
  }

  for (const [key, n] of counts) console.log(`${collection}.${field}  ${key}  ${n}`)

  const strays = await col.distinct(field, {
    [field]: { $nin: [...Object.keys(SHORT), ...Object.keys(MOVES), null, ""] },
  })
  for (const value of strays) {
    const n = await col.countDocuments({ [field]: value })
    console.log(`LEFTOVER ${collection}.${field} "${value}" ×${n} — not a school; untouched`)
    leftovers++
  }
}

if (APPLY) {
  console.log(`moved ${moved} · changed while running ${skipped} · leftovers ${leftovers}`)
} else {
  console.log(`would move ${moved} · leftovers ${leftovers}`)
  console.log("DRY RUN — nothing written. Re-run with MONGODB_URI=<uri> node scripts/migrate-schools-v2.mjs --apply")
}

await mongoose.disconnect()
process.exit(0)
