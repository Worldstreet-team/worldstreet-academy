"use server"

import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"

/**
 * Save the user's preferred language to their profile
 */
export async function updatePreferredLanguage(
  languageCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }
    // 2026-11-12: a language code ("en", "zh-CN", "mni-Mtei"), never any string or object the browser sends.
    if (typeof languageCode !== "string" || !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/.test(languageCode)) {
      return { success: false, error: "Choose a language from the list" }
    }

    await User.findByIdAndUpdate(currentUser.id, {
      preferredLanguage: languageCode,
    })

    return { success: true }
  } catch (error) {
    console.error("Update preferred language error:", error)
    return { success: false, error: "Failed to update language" }
  }
}
