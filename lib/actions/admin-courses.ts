"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/db"
import { Course, Review, User } from "@/lib/db/models"
import { requireAdmin } from "@/lib/auth/admin"
import { notifyUser } from "@/lib/notify"

const PAGE_SIZE = 20

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export type AdminCourseRow = {
  id: string
  title: string
  thumbnailUrl: string | null
  status: string
  pricing: string
  price: number | null
  level: string
  category: string
  instructorName: string
  instructorId: string
  enrolledCount: number
  totalLessons: number
  ratingAverage: number | null
  createdAt: string
  publishedAt: string | null
  availableAt: string | null
  preEnrollEnabled: boolean
}

export async function adminListCourses(filters?: {
  status?: string
  search?: string
  page?: number
}): Promise<{ courses: AdminCourseRow[]; total: number; page: number; pageCount: number }> {
  const empty = { courses: [], total: 0, page: 1, pageCount: 1 }
  try {
    await connectDB()
    await requireAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    if (filters?.status && filters.status !== "all") query.status = filters.status
    if (filters?.search?.trim()) {
      query.title = new RegExp(escapeRegex(filters.search.trim()), "i")
    }

    const [rows, total] = await Promise.all([
      Course.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("instructor", "firstName lastName")
        .lean(),
      Course.countDocuments(query),
    ])

    return {
      courses: rows.map((c) => {
        const instructor = c.instructor as unknown as {
          _id?: { toString(): string }
          firstName?: string
          lastName?: string
        } | null
        return {
          id: c._id.toString(),
          title: c.title,
          thumbnailUrl: c.thumbnailUrl ?? null,
          status: c.status,
          pricing: c.pricing,
          price: c.price ?? null,
          level: c.level,
          category: c.category ?? "",
          instructorName: instructor
            ? `${instructor.firstName ?? ""} ${instructor.lastName ?? ""}`.trim() || "Unknown"
            : "Unknown",
          instructorId: instructor?._id?.toString() ?? "",
          enrolledCount: c.enrolledCount ?? 0,
          totalLessons: c.totalLessons ?? 0,
          ratingAverage: c.rating?.average ?? null,
          createdAt: c.createdAt.toISOString(),
          publishedAt: c.publishedAt ? new Date(c.publishedAt).toISOString() : null,
          availableAt: c.availableAt ? new Date(c.availableAt).toISOString() : null,
          preEnrollEnabled: c.preEnrollEnabled ?? true,
        }
      }),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    }
  } catch (error) {
    console.error("Admin list courses error:", error)
    return empty
  }
}

/**
 * Admin course status lifecycle: draft ↔ published, plus the admin-only
 * verbs — suspended (temporarily offline), closed (no new enrollments),
 * archived (out of the catalogue).
 */
export async function adminSetCourseStatus(
  courseId: string,
  status: "draft" | "published" | "suspended" | "closed" | "archived"
) {
  try {
    await connectDB()
    await requireAdmin()

    const course = await Course.findById(courseId)
    if (!course) return { success: false, error: "Course not found" }
    if (course.status === status) return { success: true }

    if (status === "published" && (course.totalLessons ?? 0) === 0) {
      return { success: false, error: "Can't publish a course with no lessons" }
    }

    course.status = status
    if (status === "published" && !course.publishedAt) {
      course.publishedAt = new Date()
    }
    await course.save()

    const titleByStatus: Record<typeof status, string> = {
      published: "Your course was published",
      suspended: "Your course was temporarily suspended",
      closed: "Your course was closed to new enrollments",
      archived: "Your course was archived",
      draft: "Your course was moved to draft",
    }
    await notifyUser(course.instructor.toString(), {
      type: "course",
      title: titleByStatus[status],
      body: `"${course.title}" — updated by an administrator.`,
      href: `/instructor/courses/${course._id.toString()}`,
    })

    revalidatePath("/admin/courses")
    revalidatePath("/dashboard/courses")
    return { success: true }
  } catch (error) {
    console.error("Admin set course status error:", error)
    return { success: false, error: "Failed to update course status" }
  }
}

export type AdminReviewRow = {
  id: string
  rating: number
  title: string | null
  content: string | null
  reviewerName: string
  courseTitle: string
  courseId: string
  isApproved: boolean
  isHidden: boolean
  reportCount: number
  helpfulCount: number
  createdAt: string
}

export async function adminListReviews(filters?: {
  filter?: "all" | "reported" | "hidden"
  page?: number
}): Promise<{ reviews: AdminReviewRow[]; total: number; page: number; pageCount: number }> {
  const empty = { reviews: [], total: 0, page: 1, pageCount: 1 }
  try {
    await connectDB()
    await requireAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    if (filters?.filter === "reported") query.reportCount = { $gt: 0 }
    if (filters?.filter === "hidden") query.isHidden = true

    const [rows, total] = await Promise.all([
      Review.find(query)
        .sort({ reportCount: -1, createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("user", "firstName lastName")
        .populate("course", "title")
        .lean(),
      Review.countDocuments(query),
    ])

    return {
      reviews: rows.map((r) => {
        const reviewer = r.user as unknown as { firstName?: string; lastName?: string } | null
        const course = r.course as unknown as { _id?: { toString(): string }; title?: string } | null
        return {
          id: r._id.toString(),
          rating: r.rating,
          title: r.title ?? null,
          content: r.content ?? null,
          reviewerName: reviewer
            ? `${reviewer.firstName ?? ""} ${reviewer.lastName ?? ""}`.trim() || "Unknown"
            : "Unknown",
          courseTitle: course?.title ?? "Course",
          courseId: course?._id?.toString() ?? "",
          isApproved: r.isApproved,
          isHidden: r.isHidden,
          reportCount: r.reportCount ?? 0,
          helpfulCount: r.helpfulCount ?? 0,
          createdAt: r.createdAt.toISOString(),
        }
      }),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    }
  } catch (error) {
    console.error("Admin list reviews error:", error)
    return empty
  }
}

export async function adminSetReviewModeration(
  reviewId: string,
  changes: { isHidden?: boolean; isApproved?: boolean }
) {
  try {
    await connectDB()
    await requireAdmin()

    const update: Record<string, boolean> = {}
    if (typeof changes.isHidden === "boolean") update.isHidden = changes.isHidden
    if (typeof changes.isApproved === "boolean") update.isApproved = changes.isApproved
    if (Object.keys(update).length === 0) return { success: false, error: "Nothing to update" }

    const review = await Review.findByIdAndUpdate(reviewId, { $set: update }, { new: true })
    if (!review) return { success: false, error: "Review not found" }

    revalidatePath("/admin/reviews")
    return { success: true }
  } catch (error) {
    console.error("Admin review moderation error:", error)
    return { success: false, error: "Failed to update review" }
  }
}

/** Ensure the User model is registered before populate("instructor") in serverless cold paths. */
void User
