/**
 * Grandfather existing course owners as INSTRUCTOR before the portal-gating
 * flip ships. Anyone who already owns a course keeps teaching access without
 * going through the new application flow.
 *
 * - users owning ≥1 course with role USER → role INSTRUCTOR + instructorStatus "approved"
 * - existing INSTRUCTOR/ADMIN course owners → instructorStatus "approved" only
 * - Clerk publicMetadata mirrored best-effort (real Clerk ids only)
 *
 * Usage:
 *   node scripts/grandfather-instructors.mjs           # dry-run (report only)
 *   node scripts/grandfather-instructors.mjs --apply   # write changes
 */
import mongoose from "mongoose"
import { config } from "dotenv"

config({ path: ".env.local" })
config()

const APPLY = process.argv.includes("--apply")
const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI must be set")
  process.exit(1)
}

await mongoose.connect(uri)
const db = mongoose.connection.db
const users = db.collection("users")
const courses = db.collection("courses")

const ownerIds = await courses.distinct("instructor")
console.log(`${ownerIds.length} distinct course owner(s) found`)

const owners = await users.find({ _id: { $in: ownerIds } }).toArray()
let promoted = 0
let confirmed = 0

for (const owner of owners) {
  const needsRole = owner.role === "USER"
  const needsStatus = owner.instructorStatus !== "approved"
  if (!needsRole && !needsStatus) continue

  const label = `${owner.email} (${owner._id})`
  if (needsRole) {
    console.log(`${APPLY ? "→" : "would"} promote ${label}: USER → INSTRUCTOR`)
    promoted++
  } else {
    console.log(`${APPLY ? "→" : "would"} confirm ${label}: instructorStatus → approved`)
    confirmed++
  }

  if (APPLY) {
    await users.updateOne(
      { _id: owner._id },
      {
        $set: {
          ...(needsRole ? { role: "INSTRUCTOR" } : {}),
          instructorStatus: "approved",
        },
      }
    )

    if (needsRole && process.env.CLERK_SECRET_KEY && owner.authUserId?.startsWith("user_")) {
      const res = await fetch(`https://api.clerk.com/v1/users/${owner.authUserId}/metadata`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ public_metadata: { role: "instructor" } }),
      }).catch(() => null)
      if (!res?.ok) console.warn(`  ⚠ Clerk mirror failed for ${owner.email}`)
    }
  }
}

console.log(
  `\n${APPLY ? "Applied" : "Dry-run"}: ${promoted} promotion(s), ${confirmed} status confirmation(s).` +
    (APPLY ? "" : " Re-run with --apply to write.")
)
await mongoose.disconnect()
