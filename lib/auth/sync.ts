"use server"

import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import type { AuthUser } from "./types"

/**
 * Map auth service role to our DB role
 */
function mapRole(authRole: string): "USER" | "INSTRUCTOR" | "ADMIN" {
  switch (authRole.toLowerCase()) {
    case "admin":
      return "ADMIN"
    case "instructor":
      return "INSTRUCTOR"
    default:
      return "USER"
  }
}

/**
 * Generate a unique username from email
 */
function generateUsername(email: string): string {
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "")
  const random = Math.random().toString(36).substring(2, 6)
  return `${base}${random}`.toLowerCase()
}

/**
 * Generate a default avatar URL using DiceBear API
 */
function generateDefaultAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed)
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encoded}&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf&backgroundType=gradientLinear`
}

export type LocalUser = {
  id: string
  authUserId: string
  email: string
  username: string
  firstName: string
  lastName: string
  bio: string | null
  avatarUrl: string | null
  signatureUrl: string | null
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  instructorStatus: "none" | "applied" | "interview" | "approved" | "rejected"
  verified: boolean
  walletBalance: number
  hasOnboarded: boolean
  preferredLanguage: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Sync user from auth service to local MongoDB
 * - Creates user if doesn't exist
 * - Updates basic info if exists (only with valid data from login, not JWT decode)
 * Returns the local user with MongoDB _id
 */
export async function syncUserToLocal(authUser: AuthUser, updateNames = true): Promise<LocalUser> {
  await connectDB()

  // Resolve by primary id OR a previously linked one (mobile/dev Clerk
  // instances mint different ids for the same human — the Go backend has
  // always resolved both; the web now matches it).
  let user = await User.findOne({
    $or: [{ authUserId: authUser.userId }, { linkedAuthIds: authUser.userId }],
  })

  if (!user) {
    // Also check by email (in case user was created before auth sync)
    user = await User.findOne({ email: authUser.email.toLowerCase() })

    if (user) {
      // Same human, different Clerk identity (e.g. signing in against the dev
      // instance, or the mobile app's instance). LINK it — never overwrite the
      // primary authUserId: that id is the wallet subject and the production
      // login key, and clobbering it orphans both.
      if (user.authUserId && user.authUserId !== authUser.userId) {
        if (!user.linkedAuthIds?.includes(authUser.userId)) {
          user.linkedAuthIds = [...(user.linkedAuthIds ?? []), authUser.userId]
        }
      } else if (!user.authUserId) {
        user.authUserId = authUser.userId
      }
      // Only update names if provided from API (not fallbacks)
      if (authUser.firstName && authUser.firstName.length > 0) {
        user.firstName = authUser.firstName
      }
      if (authUser.lastName && authUser.lastName.length > 0) {
        user.lastName = authUser.lastName
      }
      user.verified = authUser.isVerified
      // Role is NOT taken from Clerk for an existing account — the database is
      // authoritative (roles are granted in the admin console). Only ever
      // upgrade, never silently demote an admin/instructor to USER.
      const claimedRole = mapRole(authUser.role)
      if (claimedRole !== "USER" && user.role === "USER") {
        user.role = claimedRole
      }
      // Backfill avatar for existing users without one
      if (!user.avatarUrl) {
        user.avatarUrl = generateDefaultAvatarUrl(`${user.firstName} ${user.lastName}`.trim())
      }
      await user.save()
    } else {
      // Create new user
      const emailPrefix = authUser.email.split("@")[0]
      const username = generateUsername(authUser.email)
      const firstName = authUser.firstName || emailPrefix || "User"
      const lastName = authUser.lastName || ""
      const avatarUrl = generateDefaultAvatarUrl(`${firstName} ${lastName}`.trim())
      
      user = await User.create({
        authUserId: authUser.userId,
        email: authUser.email.toLowerCase(),
        username,
        firstName,
        lastName,
        avatarUrl,
        role: mapRole(authUser.role),
        verified: authUser.isVerified,
      })
    }
  } else {
    // Update existing user - only update names if we have real values (from login API, not JWT)
    user.email = authUser.email.toLowerCase()
    user.verified = authUser.isVerified
    // Database is authoritative for role (see the linking branch above) —
    // upgrade from Clerk metadata if it grants more, never demote.
    const claimedRole = mapRole(authUser.role)
    if (claimedRole !== "USER" && user.role === "USER") {
      user.role = claimedRole
    }

    // Only update names if provided from API and updateNames is true
    if (updateNames && authUser.firstName && authUser.firstName.length > 0) {
      user.firstName = authUser.firstName
    }
    if (updateNames && authUser.lastName && authUser.lastName.length > 0) {
      user.lastName = authUser.lastName
    }

    // Backfill avatar for existing users without one
    if (!user.avatarUrl) {
      user.avatarUrl = generateDefaultAvatarUrl(`${user.firstName} ${user.lastName}`.trim())
    }

    await user.save()
  }

  return {
    id: user._id.toString(),
    authUserId: user.authUserId,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    signatureUrl: user.signatureUrl ?? null,
    role: user.role,
    instructorStatus: user.instructorStatus ?? "none",
    verified: user.verified,
    walletBalance: user.walletBalance,
    hasOnboarded: user.hasOnboarded ?? false,
    preferredLanguage: user.preferredLanguage ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

/**
 * Get local user by authUserId
 */
export async function getLocalUserByAuthId(authUserId: string): Promise<LocalUser | null> {
  await connectDB()

  // Match the primary id or any linked one (mobile / alternate Clerk instance).
  const user = await User.findOne({
    $or: [{ authUserId }, { linkedAuthIds: authUserId }],
  })

  if (!user) {
    return null
  }

  return {
    id: user._id.toString(),
    authUserId: user.authUserId,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    signatureUrl: user.signatureUrl ?? null,
    role: user.role,
    instructorStatus: user.instructorStatus ?? "none",
    verified: user.verified,
    walletBalance: user.walletBalance,
    hasOnboarded: user.hasOnboarded ?? false,
    preferredLanguage: user.preferredLanguage ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

/**
 * Get local user by MongoDB _id
 */
export async function getLocalUserById(id: string): Promise<LocalUser | null> {
  await connectDB()

  const user = await User.findById(id)

  if (!user) {
    return null
  }

  return {
    id: user._id.toString(),
    authUserId: user.authUserId,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    signatureUrl: user.signatureUrl ?? null,
    role: user.role,
    instructorStatus: user.instructorStatus ?? "none",
    verified: user.verified,
    walletBalance: user.walletBalance,
    hasOnboarded: user.hasOnboarded ?? false,
    preferredLanguage: user.preferredLanguage ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
