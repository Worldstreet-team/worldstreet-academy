"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Course, Meeting, Review, User, type CourseKind, type CourseReviewStatus } from "@/lib/db/models"
import { requireAdmin } from "@/lib/auth/admin"
import { notifyUser } from "@/lib/notify"
import { PROGRAM_KIND_FILTER, courseKindOf } from "@/lib/course-kind"
import { courseFormatOf, hasDeliverable, isFileFormat, type CourseFormat } from "@/lib/course-format"
import { creatorPublishRefusal } from "@/lib/course-review"

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
  kind: CourseKind
  /** Marketplace listings only (lib/course-format.ts); null for programs and New Economy. */
  format: CourseFormat | null
  /** The marketplace quality review; "none" for programs and faculty courses. */
  reviewStatus: CourseReviewStatus
  reviewSubmittedAt: string | null
  reviewNote: string | null
  /** Sold by an approved seller (role USER), not by faculty. */
  sellerOwned: boolean
}

export async function adminListCourses(filters?: {
  status?: string
  search?: string
  page?: number
  /** "pending" — the marketplace review queue (/admin/courses?review=pending). */
  review?: string
}): Promise<{ courses: AdminCourseRow[]; total: number; page: number; pageCount: number }> {
  const empty = { courses: [], total: 0, page: 1, pageCount: 1 }
  try {
    await connectDB()
    await requireAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    // Only literal strings reach the query — a server action may be sent anything.
    if (typeof filters?.status === "string" && filters.status !== "all") query.status = filters.status
    if (filters?.review === "pending") query["review.status"] = "pending"
    if (filters?.search?.trim()) {
      query.title = new RegExp(escapeRegex(filters.search.trim()), "i")
    }

    const [rows, total] = await Promise.all([
      Course.find(query)
        // The review queue is first come, first served.
        .sort(filters?.review === "pending" ? { "review.submittedAt": 1 } : { createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("instructor", "firstName lastName role")
        .lean(),
      Course.countDocuments(query),
    ])

    return {
      courses: rows.map((c) => {
        const instructor = c.instructor as unknown as {
          _id?: { toString(): string }
          firstName?: string
          lastName?: string
          role?: string
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
          kind: courseKindOf(c),
          format: courseFormatOf(c),
          reviewStatus: c.review?.status ?? "none",
          reviewSubmittedAt: c.review?.submittedAt ? new Date(c.review.submittedAt).toISOString() : null,
          reviewNote: c.review?.note ?? null,
          sellerOwned: instructor?.role === "USER",
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

    if (status === "published") {
      const format = courseFormatOf(course)
      if (!hasDeliverable({ format, totalLessons: course.totalLessons ?? 0, productFile: course.productFile ?? null })) {
        return {
          success: false,
          error: isFileFormat(format) ? "Can't publish a template or guide without its file" : "Can't publish a course with no lessons",
        }
      }
      // No way around the four checks: a Marketplace Creator's course is published
      // from its review page, or republished here only on content its checks cover.
      if (courseKindOf(course) === "marketplace") {
        const refusal = await creatorPublishRefusal(course)
        if (refusal) return { success: false, error: refusal }
      }
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
      courseId: course._id.toString(),
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
  featured: boolean
  reportCount: number
  helpfulCount: number
  createdAt: string
}

export async function adminListReviews(filters?: {
  filter?: "all" | "reported" | "hidden" | "featured"
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
    if (filters?.filter === "featured") query.featured = true

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
          featured: r.featured ?? false,
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

const FeatureReviewInput = z.object({
  reviewId: z.string().regex(/^[a-f0-9]{24}$/),
  featured: z.boolean(),
})

/**
 * Curate the homepage testimonials (spec §14). Only a review the landing can
 * actually show — approved, visible, 4–5★, with text — can be featured, so the
 * toggle never promises something the homepage won't render.
 */
export async function adminSetReviewFeatured(reviewId: string, featured: boolean) {
  try {
    await connectDB()
    await requireAdmin()

    const parsed = FeatureReviewInput.safeParse({ reviewId, featured })
    if (!parsed.success) return { success: false, error: "Invalid review" }

    const review = await Review.findById(parsed.data.reviewId).select("isApproved isHidden rating content").lean()
    if (!review) return { success: false, error: "Review not found" }

    if (
      parsed.data.featured &&
      (!review.isApproved || review.isHidden || review.rating < 4 || !review.content?.trim())
    ) {
      return { success: false, error: "Only approved, visible 4–5★ reviews with text can be featured" }
    }

    // Targeted write, no full-document validation: a legacy or Go-written review
    // that fails today's schema can still be curated.
    await Review.updateOne({ _id: review._id }, { $set: { featured: parsed.data.featured } })

    revalidatePath("/admin/reviews")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Admin feature review error:", error)
    return { success: false, error: "Failed to update review" }
  }
}

/* ═══════════════════ teaching faculty (owner, 2026-10-19) ═══════════════════ */

/*
 * An admin assigns faculty to teach a school program: they run its classes,
 * mentorship and grading (lib/teaching.ts). The program's owner and its sales
 * share don't change, and nothing here touches money.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/
const NOT_A_PROGRAM = "Only school programs have teaching faculty"

const AddTeachingInput = z.object({
  courseId: z.string().regex(OBJECT_ID, "Program not found"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Enter a full email address")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a full email address"),
})

const RemoveTeachingInput = z.object({
  courseId: z.string().regex(OBJECT_ID, "Program not found"),
  userId: z.string().regex(OBJECT_ID, "Faculty member not found"),
})

export type TeachingFacultyMember = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  /** False once their role is no longer INSTRUCTOR or ADMIN: still listed, but not teaching. */
  teaching: boolean
}

type TeachingResult<T> = { success: true; data: T } | { success: false; error: string }

function personName(u: { firstName?: string | null; lastName?: string | null; email?: string | null }): string {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "Faculty member"
}

/** A program's assigned teaching faculty, in the order they were added. */
export async function adminListTeachingFaculty(courseId: string): Promise<TeachingResult<TeachingFacultyMember[]>> {
  try {
    await connectDB()
    await requireAdmin()
    if (typeof courseId !== "string" || !OBJECT_ID.test(courseId)) return { success: false, error: "Program not found" }

    const course = await Course.findById(courseId).select("teachingFaculty").lean()
    if (!course) return { success: false, error: "Program not found" }
    const ids = (course.teachingFaculty ?? []).map((id) => id.toString())
    if (ids.length === 0) return { success: true, data: [] }

    const users = await User.find({ _id: { $in: ids } }).select("firstName lastName email avatarUrl role").lean()
    const byId = new Map(users.map((u) => [u._id.toString(), u]))
    return {
      success: true,
      data: ids.flatMap((id) => {
        const u = byId.get(id)
        if (!u) return []
        return [
          {
            id,
            name: personName(u),
            email: u.email,
            avatarUrl: u.avatarUrl ?? null,
            teaching: u.role === "INSTRUCTOR" || u.role === "ADMIN",
          },
        ]
      }),
    }
  } catch (error) {
    console.error("Admin list teaching faculty error:", error)
    return { success: false, error: "Couldn't load this program's faculty" }
  }
}

/** Assign an approved faculty member (INSTRUCTOR or ADMIN) to teach a program, by email. */
export async function adminAddTeachingFaculty(courseId: string, email: string): Promise<TeachingResult<{ userId: string }>> {
  try {
    await connectDB()
    await requireAdmin()
    const parsed = AddTeachingInput.safeParse({ courseId, email })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }

    const course = await Course.findById(parsed.data.courseId).select("title kind instructor teachingFaculty").lean()
    if (!course) return { success: false, error: "Program not found" }
    if (courseKindOf(course) !== "program") return { success: false, error: NOT_A_PROGRAM }

    const user = await User.findOne({ email: parsed.data.email }).select("role").lean()
    if (!user) {
      return { success: false, error: "No account uses that email. They need to sign in to the Academy once first." }
    }
    if (user._id.toString() === course.instructor.toString()) return { success: false, error: "They already own this program." }
    if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") {
      return { success: false, error: "Only approved faculty can teach a program. Approve their instructor application first." }
    }
    if ((course.teachingFaculty ?? []).some((id) => id.toString() === user._id.toString())) {
      return { success: false, error: "They already teach this program." }
    }

    // Targeted write, filtered to programs again: a kind change since the read can't slip one through.
    const updated = await Course.updateOne(
      { _id: course._id, ...PROGRAM_KIND_FILTER },
      { $addToSet: { teachingFaculty: user._id } }
    )
    if (updated.matchedCount === 0) return { success: false, error: NOT_A_PROGRAM }

    if (updated.modifiedCount > 0) {
      await notifyUser(user._id.toString(), {
        type: "system",
        title: `You're teaching ${course.title}`,
        body: "An administrator added you to this program's teaching faculty. Its classes, mentorship and grading are in your instructor dashboard.",
        href: "/instructor",
        courseId: course._id.toString(),
      })
    }

    revalidatePath(`/admin/courses/${course._id.toString()}/edit`)
    revalidatePath("/instructor")
    return { success: true, data: { userId: user._id.toString() } }
  } catch (error) {
    console.error("Admin add teaching faculty error:", error)
    return { success: false, error: "Couldn't add them to this program" }
  }
}

/** Take a faculty member off a program's teaching faculty. Their access ends on their next request. */
export async function adminRemoveTeachingFaculty(courseId: string, userId: string): Promise<TeachingResult<{ userId: string }>> {
  try {
    await connectDB()
    await requireAdmin()
    const parsed = RemoveTeachingInput.safeParse({ courseId, userId })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }

    const course = await Course.findById(parsed.data.courseId).select("title").lean()
    if (!course) return { success: false, error: "Program not found" }

    const updated = await Course.updateOne(
      { _id: course._id, teachingFaculty: parsed.data.userId },
      { $pull: { teachingFaculty: parsed.data.userId } }
    )
    if (updated.modifiedCount === 0) return { success: false, error: "They don't teach this program." }

    // Their classes on this program that haven't started are cancelled the way a
    // host's "Cancel class" does it (endMeeting): ended, the admitted host row left.
    // That drops them from students' upcoming classes and the reminder cron; as
    // on a host's cancel, students get no notice. An unstarted class has no
    // attendance to close. Live classes stay with their host to end.
    const endedAt = new Date()
    const cancelled = await Meeting.updateMany(
      { courseId: course._id, hostId: parsed.data.userId, status: "scheduled", mentorshipSessionId: null },
      {
        $set: {
          status: "ended",
          endedAt,
          "participants.$[admitted].status": "left",
          "participants.$[admitted].leftAt": endedAt,
        },
      },
      { arrayFilters: [{ "admitted.status": "admitted" }] }
    )

    await notifyUser(parsed.data.userId, {
      type: "system",
      title: `You're no longer teaching ${course.title}`,
      body:
        cancelled.modifiedCount > 0
          ? `An administrator removed you from this program's teaching faculty. Your ${cancelled.modifiedCount === 1 ? "scheduled class on it was" : `${cancelled.modifiedCount} scheduled classes on it were`} cancelled.`
          : "An administrator removed you from this program's teaching faculty.",
      href: "/instructor",
      courseId: course._id.toString(),
    })

    revalidatePath(`/admin/courses/${course._id.toString()}/edit`)
    revalidatePath("/instructor")
    return { success: true, data: { userId: parsed.data.userId } }
  } catch (error) {
    console.error("Admin remove teaching faculty error:", error)
    return { success: false, error: "Couldn't remove them from this program" }
  }
}

/** Ensure the User model is registered before populate("instructor") in serverless cold paths. */
void User
