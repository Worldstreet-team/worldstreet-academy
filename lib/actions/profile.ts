"use server"

import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { revalidatePath } from "next/cache"

/**
 * Update the current user's avatar URL
 */
export async function updateAvatar(
  avatarUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    await User.findByIdAndUpdate(currentUser.id, { avatarUrl })

    revalidatePath("/dashboard/profile")
    revalidatePath("/instructor/settings")
    revalidatePath("/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Update avatar error:", error)
    return { success: false, error: "Failed to update avatar" }
  }
}

/**
 * Update basic profile fields
 */
export async function updateProfile(data: {
  firstName?: string
  lastName?: string
  bio?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const update: Record<string, string> = {}
    if (data.firstName !== undefined) update.firstName = data.firstName.trim()
    if (data.lastName !== undefined) update.lastName = data.lastName.trim()
    if (data.bio !== undefined) update.bio = data.bio.trim()

    if (Object.keys(update).length === 0)
      return { success: false, error: "No fields to update" }

    await User.findByIdAndUpdate(currentUser.id, update)

    revalidatePath("/dashboard/profile")
    revalidatePath("/instructor/settings")
    revalidatePath("/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Update profile error:", error)
    return { success: false, error: "Failed to update profile" }
  }
}
