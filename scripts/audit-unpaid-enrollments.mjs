/**
 * WA-01 remediation audit: find paid-course enrollments that were granted by
 * the old no-payment checkout (pricePaid > 0 but no wallet transaction) and
 * flag them `legacyUnpaid: true`.
 *
 * Policy (documented decision): legacy enrollments are HONOURED — students
 * keep access — but they are excluded from instructor earnings and revenue
 * reporting, so the ledger stops claiming money that was never collected.
 *
 * Usage:
 *   node scripts/audit-unpaid-enrollments.mjs           # dry run (report only)
 *   node scripts/audit-unpaid-enrollments.mjs --apply   # flag the records
 */
import mongoose from "mongoose"
import { config } from "dotenv"

config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")
const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

await mongoose.connect(uri)
const db = mongoose.connection.db
const enrollments = db.collection("enrollments")
const courses = db.collection("courses")

const filter = {
  pricePaid: { $gt: 0 },
  $or: [{ transactionId: null }, { transactionId: { $exists: false } }, { transactionId: "" }],
  legacyUnpaid: { $ne: true },
}

const docs = await enrollments.find(filter).toArray()
let claimed = 0
const byCourse = new Map()
for (const doc of docs) {
  claimed += doc.pricePaid ?? 0
  const key = String(doc.course)
  byCourse.set(key, (byCourse.get(key) ?? 0) + 1)
}

console.log(`Found ${docs.length} paid enrollment(s) with no wallet charge on record.`)
console.log(`Ledger previously claimed $${claimed.toFixed(2)} that was never collected.`)
for (const [courseId, count] of byCourse) {
  const course = await courses.findOne({ _id: new mongoose.Types.ObjectId(courseId) }, { projection: { title: 1 } })
  console.log(`  - ${course?.title ?? courseId}: ${count} enrollment(s)`)
}

if (APPLY && docs.length > 0) {
  const res = await enrollments.updateMany(filter, { $set: { legacyUnpaid: true } })
  console.log(`\nFlagged ${res.modifiedCount} enrollment(s) as legacyUnpaid (access honoured, excluded from earnings).`)
} else if (docs.length > 0) {
  console.log("\nDry run — re-run with --apply to flag these records.")
}

await mongoose.disconnect()
