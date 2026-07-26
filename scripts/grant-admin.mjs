/**
 * Grant ADMIN to a user by email — the bootstrap for the admin console.
 * Writes Mongo (authoritative) AND mirrors the role to Clerk publicMetadata
 * so a future re-sync from Clerk can't clobber it.
 *
 * Usage:
 *   node scripts/grant-admin.mjs user@example.com
 *   node scripts/grant-admin.mjs user@example.com --revoke   # back to USER
 */
import mongoose from "mongoose"
import { config } from "dotenv"

config({ path: ".env.local" })
config()

const email = process.argv[2]?.toLowerCase()
const revoke = process.argv.includes("--revoke")
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/grant-admin.mjs <email> [--revoke]")
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI must be set")
  process.exit(1)
}

const role = revoke ? "USER" : "ADMIN"
const clerkRole = revoke ? "user" : "admin"

await mongoose.connect(uri)
const users = mongoose.connection.db.collection("users")

const user = await users.findOne({ email })
if (!user) {
  console.error(`✗ No user with email ${email}`)
  await mongoose.disconnect()
  process.exit(1)
}

await users.updateOne(
  { _id: user._id },
  { $set: { role, ...(revoke ? {} : { instructorStatus: "approved" }) } }
)
console.log(`✓ Mongo: ${email} (${user._id}) role → ${role}`)

// Mirror to Clerk publicMetadata (best-effort — skip for placeholder ids).
const secret = process.env.CLERK_SECRET_KEY
if (secret && user.authUserId?.startsWith("user_")) {
  const res = await fetch(`https://api.clerk.com/v1/users/${user.authUserId}/metadata`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ public_metadata: { role: clerkRole } }),
  })
  if (res.ok) {
    console.log(`✓ Clerk: publicMetadata.role → ${clerkRole}`)
  } else {
    console.warn(`⚠ Clerk metadata update failed (HTTP ${res.status}) — Mongo role still applies`)
  }
} else {
  console.warn("⚠ Skipped Clerk mirror (no CLERK_SECRET_KEY or non-Clerk authUserId)")
}

await mongoose.disconnect()
console.log(revoke ? "Done — admin access revoked." : "Done — sign in and open /admin.")
