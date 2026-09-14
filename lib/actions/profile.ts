"use server"

import connectDB from "@/lib/db"
import { User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { COUNTRY_CODES } from "@/lib/countries"
import {
  FACULTY_LIMITS,
  FacultyProfileSchema,
  facultyFormFrom,
  facultyProfileSet,
  firstFacultyError,
  isFacultyRole,
  type FacultyProfileForm,
} from "@/lib/faculty"

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
    if (data.bio !== undefined && data.bio.trim().length > FACULTY_LIMITS.bio)
      return { success: false, error: "Bio must be 1,000 characters or less" }

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

// ============================================================================
// FACULTY PROFILE (spec §10) — /instructor/profile; the admin dialog shares the schema
// ============================================================================

/** The signed-in user's faculty fields as editor state; null for students (only instructors and admins have one). */
export async function getMyFacultyProfile(): Promise<FacultyProfileForm | null> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser || !isFacultyRole(currentUser.role)) return null

    const user = await User.findById(currentUser.id).select("bio country instructorProfile").lean()
    return user ? facultyFormFrom(user) : null
  } catch (error) {
    console.error("Get faculty profile error:", error)
    return null
  }
}

/**
 * Save the signed-in instructor's faculty fields. Same schema as the admin
 * editor; written as a targeted $set, so the student counters and the
 * admin-only `featured` flag are untouched.
 */
export async function updateFacultyProfile(
  input: FacultyProfileForm
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }
    if (!isFacultyRole(currentUser.role)) {
      return { success: false, error: "Only instructors and admins have a faculty profile" }
    }

    const parsed = FacultyProfileSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: firstFacultyError(parsed.error) }

    await User.updateOne({ _id: currentUser.id }, { $set: facultyProfileSet(parsed.data) })

    revalidatePath("/instructor/profile")
    revalidatePath("/faculty", "layout")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Update faculty profile error:", error)
    return { success: false, error: "Failed to update faculty profile" }
  }
}

/**
 * The current user's country (ISO-3166 alpha-2). Null when unset or signed out.
 */
export async function getMyCountry(): Promise<string | null> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const user = await User.findById(currentUser.id).select("country").lean()
    return user?.country ?? null
  } catch (error) {
    console.error("Get country error:", error)
    return null
  }
}

const CountryInput = z
  .string()
  // Widened: Phase 5 may type the list as a literal tuple, whose .includes() rejects a plain string.
  .refine((code) => (COUNTRY_CODES as readonly string[]).includes(code), "Choose a country from the list")
  .nullable()

/**
 * Set or clear the current user's country — shown next to their name on
 * homepage testimonials (spec §14). Kept apart from updateProfile, which the
 * faculty editor extends.
 */
export async function updateMyCountry(
  country: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const parsed = CountryInput.safeParse(country)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Choose a country from the list" }
    }

    await User.findByIdAndUpdate(currentUser.id, { $set: { country: parsed.data } })

    revalidatePath("/dashboard/profile")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Update country error:", error)
    return { success: false, error: "Failed to update country" }
  }
}
