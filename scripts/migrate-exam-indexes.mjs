/**
 * One-time index migration for lesson-scoped exams (Phase 6).
 *
 * The Exam collection originally had a plain unique index on {course: 1}
 * (course_1) — that would forbid a course from having BOTH a final exam and
 * lesson knowledge checks. The schema now uses named partial uniques
 * (course_final_unique / lesson_quiz_unique); this script just drops the
 * retired index. Safe to run repeatedly.
 *
 *   node scripts/migrate-exam-indexes.mjs
 */
import mongoose from "mongoose"
import { config } from "dotenv"

config({ path: ".env.local" })
config()

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI must be set")
  process.exit(1)
}

await mongoose.connect(uri)
const coll = mongoose.connection.db.collection("exams")

const indexes = await coll.indexes().catch(() => [])
const names = indexes.map((i) => i.name)
console.log("existing exam indexes:", names.join(", ") || "(collection not created yet)")

if (names.includes("course_1")) {
  await coll.dropIndex("course_1")
  console.log("✓ dropped retired unique index course_1")
} else {
  console.log("✓ nothing to do — course_1 not present")
}

await mongoose.disconnect()
