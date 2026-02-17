"use server"

import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { revalidatePath } from "next/cache"

/**
 * Save the user's signature URL (works for both instructor and student)
 */
export async function saveSignature(signatureUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    await User.findByIdAndUpdate(currentUser.id, { signatureUrl })

    revalidatePath("/instructor/settings")
    revalidatePath("/dashboard/certificates")

    return { success: true }
  } catch (error) {
    console.error("Save signature error:", error)
    return { success: false, error: "Failed to save signature" }
  }
}

/**
 * Get the current user's signature URL
 */
export async function getMySignature(): Promise<string | null> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const user = await User.findById(currentUser.id).select("signatureUrl").lean()
    return user?.signatureUrl ?? null
  } catch (error) {
    console.error("Get signature error:", error)
    return null
  }
}
