/**
 * Admin levels (Phase 21, decision D32). A super admin is `role: "ADMIN"` with
 * `adminLevel: "super"`; super admins run the admin team, regular admins keep
 * every other admin power.
 *
 * This module has NO imports on purpose: client components, server code and the
 * throwaway check script all load it. `scripts/grant-admin.mjs` repeats
 * `auditActionFor`, `roleAfterRevoke` and the last-super check (it can't import
 * TypeScript), so this file is their source of truth.
 */

export type Role = "USER" | "INSTRUCTOR" | "ADMIN"
export type AdminLevel = "super" | null
export type AdminAuditAction = "grant" | "revoke" | "promote" | "demote"
export type AdminState = { role: Role; adminLevel: AdminLevel }

export const ADMIN_REFUSALS = {
  self: "You can't change your own role or admin level.",
  notSuper: "Only a super admin can grant, change or remove admin access.",
  invalid: "Only an admin can be a super admin.",
  lastSuper: "The last super admin can't be demoted. Make someone else a super admin first.",
} as const

export function isSuperAdmin(user: { role: string; adminLevel?: string | null }): boolean {
  return user.role === "ADMIN" && user.adminLevel === "super"
}

/** "super" is the only level; anything else (missing, wrong case, junk) is null. */
export function adminLevelOf(value: unknown): AdminLevel {
  return value === "super" ? "super" : null
}

export function auditActionFor(from: AdminState, to: AdminState): AdminAuditAction | null {
  if (from.role !== "ADMIN" && to.role === "ADMIN") return "grant"
  if (from.role === "ADMIN" && to.role !== "ADMIN") return "revoke"
  if (from.role === "ADMIN" && to.role === "ADMIN") {
    if (from.adminLevel === null && to.adminLevel === "super") return "promote"
    if (from.adminLevel === "super" && to.adminLevel === null) return "demote"
  }
  return null
}

/**
 * The role a removed admin goes back to: the one held when they were granted,
 * else (admins granted before audit existed) INSTRUCTOR if approved, else USER.
 */
export function roleAfterRevoke(
  lastGrantFromRole: string | null | undefined,
  instructorStatus: string | null | undefined
): "USER" | "INSTRUCTOR" {
  if (lastGrantFromRole === "USER" || lastGrantFromRole === "INSTRUCTOR") return lastGrantFromRole
  return instructorStatus === "approved" ? "INSTRUCTOR" : "USER"
}

/** Why this change must not happen, or null when it may. Checked in this order. */
export function adminChangeRefusal(input: {
  actor: { id: string; role: string; adminLevel?: string | null }
  targetId: string
  from: AdminState
  to: AdminState
  superAdminCount: number
}): string | null {
  const { actor, targetId, from, to, superAdminCount } = input
  if (actor.id === targetId) return ADMIN_REFUSALS.self
  const involvesAdmin = from.role === "ADMIN" || to.role === "ADMIN" || from.adminLevel !== to.adminLevel
  if (involvesAdmin && !isSuperAdmin(actor)) return ADMIN_REFUSALS.notSuper
  if (to.adminLevel === "super" && to.role !== "ADMIN") return ADMIN_REFUSALS.invalid
  if (from.adminLevel === "super" && to.adminLevel !== "super" && superAdminCount <= 1) {
    return ADMIN_REFUSALS.lastSuper
  }
  return null
}
