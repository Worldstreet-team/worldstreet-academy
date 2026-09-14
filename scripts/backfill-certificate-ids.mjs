/**
 * Store the legacy certificate ID on enrollments completed before IDs were
 * stored (WorldStreet Mastery Academy, Phase 6).
 *
 * Certificates have always printed `WSA-<last 8 chars of the enrollment _id,
 * uppercased>`. This writes exactly that value to `enrollments.certificateId`
 * so every PDF already downloaded stays verifiable at /verify/<id>. New
 * completions get a random ID from lib/certificate-id.ts instead.
 *
 *   MONGODB_URI=<uri> node scripts/backfill-certificate-ids.mjs           # dry run
 *   MONGODB_URI=<uri> node scripts/backfill-certificate-ids.mjs --apply   # writes
 *
 * Candidates: status "completed", completedAt set, no certificateId, and a
 * package that includes the certificate. Duplicated literally from the app's
 * TS (a .mjs script can't import it):
 *   - lib/brand.ts           BRAND.certificatePrefix ("WSA")
 *   - lib/certificate-id.ts  legacyCertificateId() — the legacy rule's third
 *                            home is printedCertificateId() in
 *                            components/learn/certificate-view.tsx; keep all equal
 *   - lib/entitlements.ts    entitlementsFor(): a null packageKey, or a package
 *                            no longer on the course, is full access (certifies)
 * Basic completions never certify and are skipped. Collisions (the legacy
 * value already stored on another enrollment, or two candidates sharing their
 * last 8 chars) are skipped and reported — never overwritten. Idempotent: a
 * re-run only revisits the rows it skipped.
 *
 * SAFETY: .env.local holds the PRODUCTION URI. A dry run may read it; --apply
 * refuses unless MONGODB_URI was set on the command line. Like
 * scripts/mastery-catalogue.mjs, raw collection writes don't bump updatedAt.
 */
import mongoose from "mongoose"
import { config } from "dotenv"

// Read BEFORE dotenv runs: dotenv never overrides a variable that is already
// set, so this is non-empty only when the operator passed the URI explicitly.
const EXPLICIT_URI = process.env.MONGODB_URI
config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")
const PREFIX = "WSA" // lib/brand.ts BRAND.certificatePrefix

if (APPLY && !EXPLICIT_URI) {
  console.error("REFUSING --apply: MONGODB_URI must be passed on the command line; a URI from .env files is never written to.")
  console.error("  MONGODB_URI=<uri> node scripts/backfill-certificate-ids.mjs --apply")
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

const enrollments = db.collection("enrollments")

// `certificateId: null` matches both a stored null and a missing field.
const candidates = await enrollments
  .find(
    { status: "completed", completedAt: { $ne: null }, certificateId: null },
    { projection: { _id: 1, course: 1, packageKey: 1 } }
  )
  .toArray()

const courseIds = [...new Map(candidates.map((e) => [e.course.toString(), e.course])).values()]
const courseById = new Map(
  (await db.collection("courses").find({ _id: { $in: courseIds } }, { projection: { packages: 1 } }).toArray()).map(
    (c) => [c._id.toString(), c]
  )
)

/** lib/entitlements.ts entitlementsFor(course, enrollment).certificate, literally. */
function certifies(course, packageKey) {
  if (!packageKey) return true
  const pkg = (course.packages ?? []).find((p) => p.key === packageKey)
  return pkg ? Boolean(pkg.entitlements?.certificate) : true
}

const counts = { candidates: candidates.length, set: 0, noCertificate: 0, courseMissing: 0, collisions: 0, changed: 0 }
const claimed = new Map() // certificateId -> enrollment id, within this run

for (const e of candidates) {
  const id = e._id.toString()
  const course = courseById.get(e.course.toString())
  if (!course) {
    console.log(`SKIP ${id} · course ${e.course} missing`)
    counts.courseMissing++
    continue
  }
  if (!certifies(course, e.packageKey ?? null)) {
    console.log(`SKIP ${id} · package "${e.packageKey}" has no certificate`)
    counts.noCertificate++
    continue
  }

  const certificateId = `${PREFIX}-${id.slice(-8).toUpperCase()}` // lib/certificate-id.ts legacyCertificateId
  const holder =
    claimed.get(certificateId) ??
    (await enrollments.findOne({ certificateId }, { projection: { _id: 1 } }))?._id.toString()
  if (holder) {
    console.log(`COLLISION ${id} · ${certificateId} already belongs to enrollment ${holder} — skipped`)
    counts.collisions++
    continue
  }
  claimed.set(certificateId, id)

  if (!APPLY) {
    console.log(`WOULD SET ${id} → ${certificateId}`)
    counts.set++
    continue
  }
  try {
    const res = await enrollments.updateOne({ _id: e._id, certificateId: null }, { $set: { certificateId } })
    if (res.modifiedCount === 1) {
      console.log(`SET ${id} → ${certificateId}`)
      counts.set++
    } else {
      console.log(`SKIP ${id} · changed while running (it has an ID now)`)
      counts.changed++
    }
  } catch (err) {
    if (err?.code !== 11000) throw err
    console.log(`COLLISION ${id} · ${certificateId} was taken while running — skipped`)
    counts.collisions++
  }
}

console.log(`\n${"-".repeat(60)}`)
console.log(
  `candidates ${counts.candidates} · ${APPLY ? "set" : "would set"} ${counts.set} · no certificate ${counts.noCertificate} · course missing ${counts.courseMissing} · collisions ${counts.collisions}${counts.changed ? ` · changed ${counts.changed}` : ""}`
)
if (!APPLY) console.log("\nDRY RUN — nothing written. Re-run with MONGODB_URI=<uri> … --apply")

await mongoose.disconnect()
