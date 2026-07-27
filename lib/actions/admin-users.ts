"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/db"
import { User, Enrollment, Order, Course, InstructorApplication } from "@/lib/db/models"
import { requireAdmin, syncRoleToClerk } from "@/lib/auth/admin"
import { notifyUser } from "@/lib/notify"

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

/**
 * Change a user's role. Writes Mongo (authoritative) and mirrors to the web
 * Clerk instance's publicMetadata so future syncs can't clobber it.
 *
 * NOTE: granting ADMIN also unlocks admin surfaces in the mobile app
 * (e.g. Vision admin) — the UI warns before confirming.
 */
export async function adminUpdateUserRole(
  userId: string,
  role: "USER" | "INSTRUCTOR" | "ADMIN"
) {
  try {
    await connectDB()
    const admin = await requireAdmin()

    if (admin.id === userId) {
      return { success: false, error: "You can't change your own role" }
    }

    const user = await User.findById(userId)
    if (!user) return { success: false, error: "User not found" }

    const previousRole = user.role
    if (previousRole === role) return { success: true }

    // Targeted $set — doc.save() would trip full validation on legacy rows.
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          role,
          ...(role !== "USER" && user.instructorStatus !== "approved"
            ? { instructorStatus: "approved" }
            : {}),
        },
      }
    )

    await syncRoleToClerk(user.authUserId, role)

    await notifyUser(user._id.toString(), {
      type: "system",
      title: "Your account role changed",
      body:
        role === "INSTRUCTOR"
          ? "You now have instructor access. Welcome aboard!"
          : role === "ADMIN"
            ? "You now have administrator access."
            : "Your account was set back to a student account.",
      href: role === "INSTRUCTOR" ? "/instructor" : "/dashboard",
    })

    revalidatePath("/admin/users")
    return { success: true }
  } catch (error) {
    console.error("Admin update role error:", error)
    return { success: false, error: "Failed to update role" }
  }
}
