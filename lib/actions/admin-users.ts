"use server"

import { revalidatePath } from "next/cache"
import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { User, Enrollment, Order, Course, InstructorApplication } from "@/lib/db/models"
import { z } from "zod/v4"
import { applyRoleChange, requireAdmin, type RoleChangeResult } from "@/lib/auth/admin"
import { adminLevelOf, type AdminLevel } from "@/lib/admin-levels"
import {
  AdminFacultyProfileSchema,
  facultyFormFrom,
  facultyProfileSet,
  firstFacultyError,
  isFacultyRole,
  type FacultyProfileForm,
} from "@/lib/faculty"

const PAGE_SIZE = 20

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export type AdminUserRow = {
  id: string
  authUserId: string
  name: string
  username: string
  email: string
  avatarUrl: string | null
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  adminLevel: AdminLevel
  instructorStatus: string
  verified: boolean
  createdAt: string
}

export type AdminUsersResult = {
  users: AdminUserRow[]
  total: number
  page: number
  pageCount: number
}

export async function adminListUsers(filters?: {
  role?: "USER" | "INSTRUCTOR" | "ADMIN"
  search?: string
  page?: number
}): Promise<AdminUsersResult> {
  const empty: AdminUsersResult = { users: [], total: 0, page: 1, pageCount: 1 }
  try {
    await connectDB()
    await requireAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    if (filters?.role) query.role = filters.role
    if (filters?.search?.trim()) {
      const rx = new RegExp(escapeRegex(filters.search.trim()), "i")
      query.$or = [{ email: rx }, { username: rx }, { firstName: rx }, { lastName: rx }]
    }

    const [rows, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      User.countDocuments(query),
    ])

    return {
      users: rows.map((u) => ({
        id: u._id.toString(),
        authUserId: u.authUserId,
        name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username,
        username: u.username,
        email: u.email,
        avatarUrl: u.avatarUrl ?? null,
        role: u.role,
        adminLevel: adminLevelOf(u.adminLevel),
        instructorStatus: u.instructorStatus ?? "none",
        verified: u.verified,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    }
  } catch (error) {
    console.error("Admin list users error:", error)
    return empty
  }
}

export type AdminUserDetail = AdminUserRow & {
  bio: string | null
  hasOnboarded: boolean
  enrollmentCount: number
  orderCount: number
  coursesOwned: number
  latestApplication: { id: string; status: string; createdAt: string } | null
}

export async function adminGetUserDetail(userId: string): Promise<AdminUserDetail | null> {
  try {
    await connectDB()
    await requireAdmin()

    const u = await User.findById(userId).lean()
    if (!u) return null

    const [enrollmentCount, orderCount, coursesOwned, latestApp] = await Promise.all([
      Enrollment.countDocuments({ user: u._id }),
      Order.countDocuments({ user: u._id }),
      Course.countDocuments({ instructor: u._id }),
      InstructorApplication.findOne({ user: u._id }).sort({ createdAt: -1 }).lean(),
    ])

    return {
      id: u._id.toString(),
      authUserId: u.authUserId,
      name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username,
      username: u.username,
      email: u.email,
      avatarUrl: u.avatarUrl ?? null,
      role: u.role,
      adminLevel: adminLevelOf(u.adminLevel),
      instructorStatus: u.instructorStatus ?? "none",
      verified: u.verified,
      createdAt: u.createdAt.toISOString(),
      bio: u.bio ?? null,
      hasOnboarded: u.hasOnboarded ?? false,
      enrollmentCount,
      orderCount,
      coursesOwned,
      latestApplication: latestApp
        ? {
            id: latestApp._id.toString(),
            status: latestApp.status,
            createdAt: latestApp.createdAt.toISOString(),
          }
        : null,
    }
  } catch (error) {
    console.error("Admin get user detail error:", error)
    return null
  }
}

const RoleChangeInput = z.object({
  userId: z.string().regex(/^[a-f0-9]{24}$/, "User not found"),
  role: z.enum(["USER", "INSTRUCTOR", "ADMIN"], "Choose a valid role"),
})

/**
 * Change a user's role. Goes through applyRoleChange (D32): only super admins
 * may involve ADMIN; regular admins move accounts between student and
 * instructor. Mongo is authoritative; the role is mirrored to Clerk.
 *
 * NOTE: granting ADMIN also unlocks admin surfaces in the mobile app
 * (e.g. Vision admin) — the UI warns before confirming.
 */
export async function adminUpdateUserRole(
  userId: string,
  role: "USER" | "INSTRUCTOR" | "ADMIN"
): Promise<RoleChangeResult> {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const parsed = RoleChangeInput.safeParse({ userId, role })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Choose a valid role" }
    }

    const result = await applyRoleChange(admin, parsed.data.userId, (t) => ({
      role: parsed.data.role,
      adminLevel: parsed.data.role === "ADMIN" ? t.adminLevel : null,
    }))
    if (result.success) {
      revalidatePath("/admin/users")
      revalidatePath("/admin/team")
    }
    return result
  } catch (error) {
    console.error("Admin update role error:", error)
    const denied = error instanceof Error && error.message === "Not authorized"
    return { success: false, error: denied ? "Not authorized" : "Failed to update role" }
  }
}

// ============================================================================
// FACULTY PROFILE (spec §10) — the "Edit faculty profile" dialog on /admin/users
// ============================================================================

export type AdminFacultyProfile = {
  userId: string
  name: string
  username: string
  form: FacultyProfileForm
  featured: boolean
}

/** One instructor's or admin's faculty fields for the admin dialog; null for students and unknown ids. */
export async function adminGetFacultyProfile(userId: string): Promise<AdminFacultyProfile | null> {
  try {
    await connectDB()
    await requireAdmin()
    if (!mongoose.isValidObjectId(userId)) return null

    const u = await User.findById(userId)
      .select("username firstName lastName role bio country instructorProfile")
      .lean()
    if (!u || !isFacultyRole(u.role)) return null

    return {
      userId: u._id.toString(),
      name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username,
      username: u.username,
      form: facultyFormFrom(u),
      featured: u.instructorProfile?.featured ?? false,
    }
  } catch (error) {
    console.error("Admin get faculty profile error:", error)
    return null
  }
}

/**
 * Admin save of a faculty profile: the instructor editor's schema plus
 * `featured`. Name and photo are not editable here — they belong to the
 * account owner, who sets them on /instructor/profile.
 */
export async function adminUpdateFacultyProfile(
  userId: string,
  input: FacultyProfileForm & { featured: boolean }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    await requireAdmin()

    if (!mongoose.isValidObjectId(userId)) return { success: false, error: "User not found" }
    const user = await User.findById(userId).select("role").lean()
    if (!user) return { success: false, error: "User not found" }
    if (!isFacultyRole(user.role)) {
      return { success: false, error: "Only instructors and admins have a faculty profile" }
    }

    const parsed = AdminFacultyProfileSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: firstFacultyError(parsed.error) }

    const { featured, ...profile } = parsed.data
    await User.updateOne(
      { _id: user._id },
      { $set: { ...facultyProfileSet(profile), "instructorProfile.featured": featured } }
    )

    revalidatePath("/admin/users")
    revalidatePath("/faculty", "layout")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Admin update faculty profile error:", error)
    const denied = error instanceof Error && error.message === "Not authorized"
    return { success: false, error: denied ? "Not authorized" : "Failed to update faculty profile" }
  }
}
