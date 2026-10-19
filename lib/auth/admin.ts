import "server-only"

import { isSuperAdmin } from "@/lib/admin-levels"
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
