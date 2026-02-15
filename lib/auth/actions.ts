"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { syncUserToLocal, getLocalUserByAuthId, type LocalUser } from "./sync"
import type { AuthUser } from "./types"

// ============================================================================
// CLERK-BASED AUTH ACTIONS
// ============================================================================

/**
 * Get current authenticated user
 * - Uses Clerk auth() to get the user's Clerk ID
 * - Gets/syncs user from local MongoDB
 * - Safe to call from RSC / Route Handlers / Server Actions
 */
export async function getCurrentUser(): Promise<LocalUser | null> {
  try {
    const { userId } = await auth()

    if (!userId) return null

    // Check if user already exists in local DB by Clerk userId
    const existingUser = await getLocalUserByAuthId(userId)
    if (existingUser) return existingUser

    // User not in local DB yet — fetch full profile from Clerk and sync
    const clerkUser = await currentUser()
    if (!clerkUser) return null

    const authUser: AuthUser = {
      userId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      role: (clerkUser.publicMetadata?.role as "user" | "instructor" | "admin") || "user",
      isVerified: clerkUser.emailAddresses[0]?.verification?.status === "verified",
      createdAt: new Date(clerkUser.createdAt).toISOString(),
    }

    return await syncUserToLocal(authUser)
  } catch (error) {
    console.error("[Auth] getCurrentUser error:", error)
    return null
  }
}

/**
 * Verify token and get user (for protected routes)
 * - Uses Clerk auth
 * - Returns local user from MongoDB
 */
export async function verifyAuth(): Promise<{ user: LocalUser } | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return { user }
}

/**
 * Logout user — redirects to the main site login page.
 * The actual session invalidation is handled by Clerk.
 */
export async function logoutAction() {
  redirect("https://www.worldstreetgold.com/login")
}

/**
 * Logout from all sessions.
 */
export async function logoutAllAction() {
  redirect("https://www.worldstreetgold.com/login")
}

/**
 * Check if user is authenticated (lightweight check)
 */
export async function isAuthenticated(): Promise<boolean> {
  const { userId } = await auth()
  return !!userId
}

/**
 * Get the Clerk access token for API calls (if needed)
 */
export async function getAccessToken(): Promise<string | null> {
  const { getToken } = await auth()
  return await getToken()
}
