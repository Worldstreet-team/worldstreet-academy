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

export type LocalUser = {
  id: string
  authUserId: string
  email: string
  username: string
  firstName: string
  lastName: string
  bio: string | null
  avatarUrl: string | null
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  verified: boolean
  walletBalance: number
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

  // Try to find existing user by authUserId
  let user = await User.findOne({ authUserId: authUser.userId })

  if (!user) {
    // Also check by email (in case user was created before auth sync)
    user = await User.findOne({ email: authUser.email.toLowerCase() })

    if (user) {
      // Link existing user to auth service
      user.authUserId = authUser.userId
      // Only update names if provided from API (not fallbacks)
      if (authUser.firstName && authUser.firstName.length > 0) {
        user.firstName = authUser.firstName
      }
      if (authUser.lastName && authUser.lastName.length > 0) {
        user.lastName = authUser.lastName
      }
      user.verified = authUser.isVerified
      user.role = mapRole(authUser.role)
      await user.save()
    } else {
      // Create new user
      const emailPrefix = authUser.email.split("@")[0]
      const username = generateUsername(authUser.email)
      
      user = await User.create({
        authUserId: authUser.userId,
        email: authUser.email.toLowerCase(),
        username,
        firstName: authUser.firstName || emailPrefix || "User",
        lastName: authUser.lastName || "",
        role: mapRole(authUser.role),
        verified: authUser.isVerified,
      })
    }
  } else {
    // Update existing user - only update names if we have real values (from login API, not JWT)
    user.email = authUser.email.toLowerCase()
    user.verified = authUser.isVerified
    user.role = mapRole(authUser.role)
    
    // Only update names if provided from API and updateNames is true
    if (updateNames && authUser.firstName && authUser.firstName.length > 0) {
      user.firstName = authUser.firstName
    }
    if (updateNames && authUser.lastName && authUser.lastName.length > 0) {
      user.lastName = authUser.lastName
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
    role: user.role,
    verified: user.verified,
    walletBalance: user.walletBalance,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

/**
 * Get local user by authUserId
 */
export async function getLocalUserByAuthId(authUserId: string): Promise<LocalUser | null> {
  await connectDB()

  const user = await User.findOne({ authUserId })

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
    role: user.role,
    verified: user.verified,
    walletBalance: user.walletBalance,
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
    role: user.role,
    verified: user.verified,
    walletBalance: user.walletBalance,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
