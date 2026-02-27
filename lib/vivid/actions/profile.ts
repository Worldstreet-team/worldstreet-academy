"use server"

import { Enrollment } from "@/lib/db/models"
import { initAction } from "./helpers"

export async function vividGetUserProfile() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const [activeEnrollments, completedEnrollments] = await Promise.all([
      Enrollment.countDocuments({ user: currentUser.id, status: "active" }),
      Enrollment.countDocuments({ user: currentUser.id, status: "completed" }),
    ])

    return {
      success: true,
      profile: {
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        email: currentUser.email,
        role: currentUser.role,
        avatarUrl: currentUser.avatarUrl,
        walletBalance: currentUser.walletBalance,
        hasOnboarded: currentUser.hasOnboarded,
        activeEnrollments,
        completedEnrollments,
      },
    }
  } catch (error) {
    console.error("[Vivid] getUserProfile error:", error)
    return { success: false, error: "Failed to get profile" }
  }
}

export async function vividUpdateProfile(p: { firstName?: string; lastName?: string; bio?: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { updateProfile } = await import("@/lib/actions/profile")
    await updateProfile(p)
    return { success: true, message: "Profile updated!" }
  } catch (error) {
    console.error("[Vivid] updateProfile error:", error)
    return { success: false, error: "Failed to update profile" }
  }
}

export async function vividChangeLanguage(p: { languageCode: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { updatePreferredLanguage } = await import("@/lib/actions/language")
    await updatePreferredLanguage(p.languageCode)
    return { success: true, languageCode: p.languageCode, message: `Language changed to ${p.languageCode}` }
  } catch (error) {
    console.error("[Vivid] changeLanguage error:", error)
    return { success: false, error: "Failed to change language" }
  }
}
