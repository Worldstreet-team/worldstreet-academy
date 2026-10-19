/**
 * Grant or remove ADMIN access by email — the bootstrap for the admin console
 * and for super admins (D32). Writes Mongo (authoritative), records the change
 * in the user's adminAudit, and mirrors a changed role to Clerk publicMetadata.
 *
 * Usage (MONGODB_URI is REQUIRED on the command line — .env.local points at
 * production, so the script refuses to fall back to it):
 *   MONGODB_URI=<uri> node scripts/grant-admin.mjs user@example.com            # admin (keeps an existing level)
 *   MONGODB_URI=<uri> node scripts/grant-admin.mjs user@example.com --super    # super admin
 *   MONGODB_URI=<uri> node scripts/grant-admin.mjs user@example.com --revoke   # remove admin access
 *
 * --revoke restores the role held before the grant (the latest grant entry's
 * fromRole); admins granted before the audit existed become INSTRUCTOR if
 * their instructorStatus is "approved", else USER. It refuses the last super admin.
 *
 * The rules (auditActionFor, roleAfterRevoke, the last-super check) are repeated
 * below because a .mjs script can't import TypeScript. lib/admin-levels.ts is
 * their source of truth: keep the two in step.
 */
import mongoose from "mongoose"
import { config } from "dotenv"

// Captured BEFORE .env.local loads: that file's MONGODB_URI is production.
const EXPLICIT_URI = process.env.MONGODB_URI
// Captured BEFORE .env.local loads too: the Clerk mirror runs only with an explicit key.
const EXPLICIT_CLERK_KEY = process.env.CLERK_SECRET_KEY
config({ path: ".env.local" })
config()

const USAGE = "Usage: MONGODB_URI=<uri> node scripts/grant-admin.mjs <email> [--super | --revoke]"

if (!EXPLICIT_URI) {
  console.error("REFUSING: MONGODB_URI must be passed on the command line (.env.local points at production).")
  console.error(USAGE)
  process.exit(1)
}

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith("--"))
const positional = args.filter((a) => !a.startsWith("--"))
const email = positional[0]?.toLowerCase()
const makeSuper = flags.includes("--super")
const revoke = flags.includes("--revoke")
if (
  !email ||
  !email.includes("@") ||
  positional.length !== 1 ||
  flags.some((f) => f !== "--super" && f !== "--revoke") ||
  (makeSuper && revoke)
) {
  console.error(USAGE)
  process.exit(1)
}

// --- Rules repeated from lib/admin-levels.ts ---------------------------------
const auditActionFor = (from, to) => {
  if (from.role !== "ADMIN" && to.role === "ADMIN") return "grant"
  if (from.role === "ADMIN" && to.role !== "ADMIN") return "revoke"
  if (from.role === "ADMIN" && to.role === "ADMIN") {
    if (from.adminLevel === null && to.adminLevel === "super") return "promote"
    if (from.adminLevel === "super" && to.adminLevel === null) return "demote"
  }
  return null
}
const roleAfterRevoke = (lastGrantFromRole, instructorStatus) => {
  if (lastGrantFromRole === "USER" || lastGrantFromRole === "INSTRUCTOR") return lastGrantFromRole
  return instructorStatus === "approved" ? "INSTRUCTOR" : "USER"
}
const levelOf = (value) => (value === "super" ? "super" : null)
const describe = (s) => (s.role === "ADMIN" ? `ADMIN/${s.adminLevel ?? "admin"}` : s.role)
// -----------------------------------------------------------------------------

await mongoose.connect(EXPLICIT_URI)
const users = mongoose.connection.db.collection("users")

async function finish(code) {
  await mongoose.disconnect()
  process.exit(code)
}

const user = await users.findOne({ email })
if (!user) {
  console.error(`✗ No user with email ${email}`)
  await finish(1)
}

const from = { role: user.role, adminLevel: levelOf(user.adminLevel) }
let to
if (revoke) {
  if (from.role !== "ADMIN") {
    console.error(`✗ ${email} isn't an admin (${from.role}).`)
    await finish(1)
  }
  const lastGrant = [...(user.adminAudit ?? [])].reverse().find((e) => e.action === "grant")
  to = { role: roleAfterRevoke(lastGrant?.fromRole, user.instructorStatus), adminLevel: null }
} else if (makeSuper) {
  to = { role: "ADMIN", adminLevel: "super" }
} else {
  to = { role: "ADMIN", adminLevel: from.role === "ADMIN" ? from.adminLevel : null }
}

if (from.role === to.role && from.adminLevel === to.adminLevel) {
  console.log(`• ${email} is already ${describe(from)} — nothing to change.`)
  await finish(0)
}

if (from.adminLevel === "super" && to.adminLevel !== "super") {
  const supers = await users.countDocuments({ role: "ADMIN", adminLevel: "super" })
  if (supers <= 1) {
    console.error(`✗ ${email} is the last super admin. Make someone else a super admin first (--super).`)
    await finish(1)
  }
}

const action = auditActionFor(from, to)
const set = { role: to.role, adminLevel: to.adminLevel }
// Granting ADMIN never touches instructorStatus (removal restores the earlier role).
if (to.role === "INSTRUCTOR" && user.instructorStatus !== "approved") set.instructorStatus = "approved"
const update = { $set: set }
if (action) {
  update.$push = {
    adminAudit: {
      action,
      fromRole: from.role,
      toRole: to.role,
      fromLevel: from.adminLevel,
      toLevel: to.adminLevel,
      by: null,
      at: new Date(),
    },
  }
}

// Filtered on the role we read, so a concurrent change makes this a no-op.
const result = await users.updateOne({ _id: user._id, role: from.role }, update)
if (result.matchedCount !== 1) {
  console.error(`✗ ${email} changed while the script ran. Nothing was written; run it again.`)
  await finish(1)
}
console.log(`✓ Mongo: ${email} (${user._id}) ${describe(from)} → ${describe(to)}`)

// Mirror to Clerk publicMetadata only when the role changed (best-effort — skip for placeholder ids).
if (from.role === to.role) {
  console.log("• Clerk: role unchanged — nothing to mirror.")
} else {
  const clerkRole = to.role.toLowerCase()
  const secret = EXPLICIT_CLERK_KEY
  if (!secret) {
    console.log("skipped Clerk mirror (pass CLERK_SECRET_KEY on the command line to mirror)")
  } else if (user.authUserId?.startsWith("user_")) {
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
    console.warn("⚠ Skipped Clerk mirror (non-Clerk authUserId)")
  }
}

await mongoose.disconnect()
console.log(
  revoke
    ? "Done — admin access removed."
    : `Done — sign in and open ${to.adminLevel === "super" ? "/admin/team" : "/admin"}.`
)
