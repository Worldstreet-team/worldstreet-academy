import "server-only"

import { Types } from "mongoose"
import {
  ADMIN_REFUSALS,
  adminChangeRefusal,
  adminLevelOf,
  auditActionFor,
  isSuperAdmin,
  type AdminAuditAction,
  type AdminLevel,
  type AdminState,
  type Role,
} from "@/lib/admin-levels"
import { User, type InstructorStatus } from "@/lib/db/models"
import { notifyUser } from "@/lib/notify"
import { getCurrentUser } from "./actions"
import type { LocalUser } from "./sync"

/**
 * Guard for admin-only server actions. Throws when the caller isn't an ADMIN —
 * actions catch this and return their usual { success: false, error } shape.
 */
export async function requireAdmin(): Promise<LocalUser> {
  const user = await getCurrentUser()
  if (!user || user.role !== "ADMIN") {
    throw new Error("Not authorized")
  }
  return user
}

/**
 * Guard for D32 actions (granting, changing and removing admin access). The
 * database is re-read on every call, so a demotion takes effect on the very
 * next request.
 */
export async function requireSuperAdmin(): Promise<LocalUser> {
  const user = await requireAdmin()
  if (!isSuperAdmin(user)) {
    throw new Error("Not authorized")
  }
  return user
}

/**
 * Best-effort write-back of a role change to the web Clerk instance's
 * publicMetadata, so a future re-sync from Clerk can never clobber a role
 * granted in the admin UI. Never throws — Mongo remains the source of truth
 * (mobile placeholder ids and dev-instance users won't exist here).
 */
export async function syncRoleToClerk(
  authUserId: string,
  role: "USER" | "INSTRUCTOR" | "ADMIN"
): Promise<void> {
  try {
    const { clerkClient } = await import("@clerk/nextjs/server")
    const client = await clerkClient()
    await client.users.updateUserMetadata(authUserId, {
      publicMetadata: { role: role.toLowerCase() },
    })
  } catch (err) {
    console.warn(`[Admin] Clerk metadata sync skipped for ${authUserId}:`, err instanceof Error ? err.message : err)
  }
}

export type RoleTarget = {
  id: string
  role: Role
  adminLevel: AdminLevel
  instructorStatus: InstructorStatus
  /** The role held when the latest grant happened; null for admins granted before audit existed. */
  lastGrantFromRole: Role | null
}

export type RoleChangeResult =
  | { success: true; data: { role: Role; adminLevel: AdminLevel; changed: boolean } }
  | { success: false; error: string }

const ROLES: readonly string[] = ["USER", "INSTRUCTOR", "ADMIN"]

function notice(
  action: AdminAuditAction | null,
  to: AdminState
): { title: string; body: string; href: string } {
  if (action === "grant") {
    return { title: "Your account role changed", body: "You now have administrator access.", href: "/admin" }
  }
  if (action === "revoke") {
    return to.role === "INSTRUCTOR"
      ? { title: "Your admin access was removed", body: "Your account is an instructor account again.", href: "/instructor" }
      : { title: "Your admin access was removed", body: "Your account is a student account again.", href: "/dashboard" }
  }
  if (action === "promote") {
    return { title: "You're now a super admin", body: "You can now add and remove admins from Team.", href: "/admin/team" }
  }
  if (action === "demote") {
    return { title: "Your super admin access was removed", body: "You're still an admin.", href: "/admin" }
  }
  return to.role === "INSTRUCTOR"
    ? { title: "Your account role changed", body: "You now have instructor access. Welcome aboard!", href: "/instructor" }
    : { title: "Your account role changed", body: "Your account was set back to a student account.", href: "/dashboard" }
}

/**
 * The one write path for roles and admin levels (D32). Refuses, writes with a
 * state filter, audits, mirrors the role to Clerk and notifies. Never re-export
 * it from a "use server" file: every export there is callable from the browser.
 * The caller has already called connectDB() and authenticated `actor`.
 */
export async function applyRoleChange(
  actor: LocalUser,
  targetId: string,
  next: (target: RoleTarget) => AdminState | string
): Promise<RoleChangeResult> {
  // 1. Load
  if (!/^[a-f0-9]{24}$/i.test(targetId)) return { success: false, error: "User not found" }
  const doc = await User.findById(targetId)
    .select("role adminLevel instructorStatus authUserId adminAudit")
    .lean()
  if (!doc || !ROLES.includes(doc.role)) return { success: false, error: "User not found" }

  const from: AdminState = { role: doc.role, adminLevel: adminLevelOf(doc.adminLevel) }
  const grants = (doc.adminAudit ?? []).filter((e) => e.action === "grant")
  const target: RoleTarget = {
    id: doc._id.toString(),
    role: from.role,
    adminLevel: from.adminLevel,
    instructorStatus: doc.instructorStatus ?? "none",
    lastGrantFromRole: grants.length ? grants[grants.length - 1].fromRole : null,
  }

  // 2. Next
  const to = next(target)
  if (typeof to === "string") return { success: false, error: to }

  // 3. Refuse (before the no-op check, so a forbidden no-op is still refused)
  const superAdminCount = await User.countDocuments({ role: "ADMIN", adminLevel: "super" })
  const refusal = adminChangeRefusal({ actor, targetId: target.id, from, to, superAdminCount })
  if (refusal) return { success: false, error: refusal }

  // 4. No-op
  if (from.role === to.role && from.adminLevel === to.adminLevel) {
    return { success: true, data: { ...to, changed: false } }
  }

  // 5. Write, filtered on the state we read
  const action = auditActionFor(from, to)
  const entry =
    action === null
      ? null
      : {
          action,
          fromRole: from.role,
          toRole: to.role,
          fromLevel: from.adminLevel,
          toLevel: to.adminLevel,
          by: new Types.ObjectId(actor.id),
          at: new Date(),
        }
  const approve =
    to.role === "INSTRUCTOR" && from.role !== "INSTRUCTOR" && target.instructorStatus !== "approved"
  const written = await User.updateOne(
    { _id: doc._id, role: from.role, adminLevel: from.adminLevel },
    {
      $set: { role: to.role, adminLevel: to.adminLevel, ...(approve ? { instructorStatus: "approved" } : {}) },
      ...(entry ? { $push: { adminAudit: entry } } : {}),
    }
  )
  if (written.matchedCount === 0) {
    return { success: false, error: "This account changed in the meantime. Reload and try again." }
  }

  // 6. Recount: two super admins demoting each other at once must not leave zero
  if (from.adminLevel === "super" && to.adminLevel !== "super") {
    const left = await User.countDocuments({ role: "ADMIN", adminLevel: "super" })
    if (left === 0) {
      await User.updateOne(
        { _id: doc._id },
        {
          $set: { role: from.role, adminLevel: from.adminLevel },
          ...(entry ? { $pull: { adminAudit: { at: entry.at, by: entry.by } } } : {}),
        }
      )
      return { success: false, error: ADMIN_REFUSALS.lastSuper }
    }
  }

  // 7. Mirror
  if (from.role !== to.role && doc.authUserId) await syncRoleToClerk(doc.authUserId, to.role)

  // 8. Notify
  await notifyUser(target.id, { type: "system", ...notice(action, to) })

  return { success: true, data: { ...to, changed: true } }
}
