"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import {
  Course,
  Lesson,
  User,
  type CoursePricing,
  type CourseReviewStatus,
  type CourseStatus,
  type LessonType,
} from "@/lib/db/models"
import { requireAdmin } from "@/lib/auth/admin"
import { notifyUser } from "@/lib/notify"
import { sendCourseReviewDecisionEmail } from "@/lib/email"
import { appUrl } from "@/lib/app-url"
import { courseFormatOf, hasDeliverable, isFileFormat, productTypeLabel, type CourseFormat } from "@/lib/course-format"
import { courseReviewFingerprint } from "@/lib/course-review"
import {
  REVIEW_CHECKS,
  REVIEW_CHECK_DETAILS,
  REVIEW_CHECK_STATUSES,
  outstandingChecks,
  statusAllowed,
  type ReviewCheckKey,
  type ReviewCheckStatus,
} from "@/lib/review-checks"

/**
 * The marketplace quality review, admin side (owner, 2026-10-05). A seller
 * submits a draft marketplace course (lib/course-review.ts); here an admin
 * records the four quality checks (lib/review-checks.ts) one by one. Approval
 * publishes the course and needs all four cleared on its current content;
 * "changes" on any check sends it back at once, with the note. Both tell the
 * seller in the app and by email.
 * Faculty marketplace courses never come through here: they publish directly.
 */

type Result = { success: true; data: null } | { success: false; error: string }

const CourseId = z.string().regex(/^[a-f0-9]{24}$/, "Invalid course")

const CheckInput = z
  .object({
    courseId: CourseId,
    check: z.enum(REVIEW_CHECKS),
    status: z.enum(REVIEW_CHECK_STATUSES),
    note: z.string().trim().max(2000, "Keep the note to 2,000 characters"),
  })
  .refine((v) => statusAllowed(v.check, v.status), {
    message: "Only the accuracy review can be marked not applicable",
    path: ["status"],
  })
  .refine((v) => v.status !== "changes" || v.note.length >= 5, {
    message: "Tell the Marketplace Creator what to change (at least 5 characters)",
    path: ["note"],
  })

const CHANGED_MESSAGE = "This course changed since you opened it — reload to review the latest version"

async function sellerContact(userId: string) {
  return User.findById(userId).select("email firstName").lean()
}

/** Approve: review "approved", the course and its lessons published, publishedAt stamped once. */
export async function adminApproveCourseReview(courseId: string, seenFingerprint: string): Promise<Result> {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const id = CourseId.safeParse(courseId)
    if (!id.success) return { success: false, error: "Invalid course" }

    const course = await Course.findOne({ _id: id.data, kind: "marketplace", "review.status": "pending" })
      .select("title slug instructor publishedAt totalLessons kind format productFile review.checks")
      .lean()
    if (!course) return { success: false, error: "This course isn't waiting for review" }
    const format = courseFormatOf(course)
    if (!hasDeliverable({ format, totalLessons: course.totalLessons ?? 0, productFile: course.productFile ?? null })) {
      return {
        success: false,
        error: isFileFormat(format) ? "Can't publish a template or guide without its file" : "Can't publish a course with no lessons",
      }
    }
    // Approval waits for all four checks, recorded on the content as it is now (ruling 7).
    const fingerprint = await courseReviewFingerprint(id.data)
    if (!fingerprint || fingerprint !== seenFingerprint) return { success: false, error: CHANGED_MESSAGE }
    const outstanding = outstandingChecks(course.review?.checks, fingerprint)
    if (outstanding.length > 0) {
      return {
        success: false,
        error: `Every check must pass first. Still to do: ${outstanding.map((k) => REVIEW_CHECK_DETAILS[k].title).join(", ")}`,
      }
    }

    const now = new Date()
    // Targeted write, guarded on "pending" so a double click approves once.
    const res = await Course.updateOne(
      { _id: course._id, "review.status": "pending" },
      {
        $set: {
          status: "published",
          publishedAt: course.publishedAt ?? now,
          "review.status": "approved",
          "review.reviewedAt": now,
          "review.reviewedBy": admin.id,
          "review.note": null,
        },
      }
    )
    if (res.modifiedCount === 0) return { success: false, error: "This course isn't waiting for review" }
    // A seller saves drafts, so every lesson was saved unpublished — the
    // editor's "Save & Publish" would publish them all; approval does the same.
    await Lesson.updateMany({ course: course._id, isPublished: false }, { $set: { isPublished: true } })

    const id_ = course._id.toString()
    void notifyUser(course.instructor.toString(), {
      type: "course",
      title: "Your course is live",
      body: `“${course.title}” passed review and is on the marketplace.`.slice(0, 500),
      href: `/instructor/courses/${id_}`,
      courseId: id_,
    })
    const seller = await sellerContact(course.instructor.toString())
    if (seller?.email) {
      void sendCourseReviewDecisionEmail({
        to: seller.email,
        firstName: seller.firstName ?? "",
        courseTitle: course.title,
        approved: true,
        note: null,
        ctaUrl: appUrl(`/programs/${course.slug}`),
      })
    }

    revalidatePath("/admin/courses")
    revalidatePath("/instructor/courses")
    revalidatePath("/marketplace")
    revalidatePath(`/programs/${course.slug}`)
    return { success: true, data: null }
  } catch (error) {
    console.error("Approve course review error:", error)
    return { success: false, error: "Failed to approve the course" }
  }
}

/**
 * Record one quality check on a pending course, against its content as it is
 * now. "changes" sends the course back at once (ruling 8): the note is
 * prefixed with the check's title and the creator is told in the app and by
 * email; the other checks wait for the re-submission.
 */
export async function adminRecordReviewCheck(
  courseId: string,
  check: ReviewCheckKey,
  status: ReviewCheckStatus,
  note: string,
  seenFingerprint: string
): Promise<Result> {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const parsed = CheckInput.safeParse({ courseId, check, status, note })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    const input = parsed.data

    const course = await Course.findOne({ _id: input.courseId, kind: "marketplace", "review.status": "pending" })
      .select("title instructor")
      .lean()
    if (!course) return { success: false, error: "This course isn't waiting for review" }
    const fingerprint = await courseReviewFingerprint(input.courseId)
    if (!fingerprint) return { success: false, error: "This course isn't waiting for review" }
    // Record against the content the admin actually saw, never the content at the moment of the click.
    if (fingerprint !== seenFingerprint) return { success: false, error: CHANGED_MESSAGE }

    const now = new Date()
    const prefixed = `${REVIEW_CHECK_DETAILS[input.check].title}: ${input.note}`
    const res = await Course.updateOne(
      { _id: course._id, "review.status": "pending" },
      {
        $set: {
          [`review.checks.${input.check}`]: {
            status: input.status,
            by: admin.id,
            at: now,
            note: input.note || null,
            contentHash: fingerprint,
          },
          ...(input.status === "changes"
            ? {
                "review.status": "changes_requested",
                "review.reviewedAt": now,
                "review.reviewedBy": admin.id,
                "review.note": prefixed,
              }
            : {}),
        },
      }
    )
    if (res.modifiedCount === 0) return { success: false, error: "This course isn't waiting for review" }

    const id_ = course._id.toString()
    if (input.status === "changes") {
      void notifyUser(course.instructor.toString(), {
        type: "course",
        title: `Changes requested: ${course.title}`.slice(0, 120),
        body: prefixed.slice(0, 500),
        href: `/instructor/courses/${id_}/edit`,
        courseId: id_,
      })
      const seller = await sellerContact(course.instructor.toString())
      if (seller?.email) {
        void sendCourseReviewDecisionEmail({
          to: seller.email,
          firstName: seller.firstName ?? "",
          courseTitle: course.title,
          approved: false,
          note: prefixed,
          ctaUrl: appUrl(`/instructor/courses/${id_}/edit`),
        })
      }
    }

    revalidatePath("/admin/courses")
    revalidatePath(`/admin/courses/${id_}/review`)
    revalidatePath("/instructor/courses")
    revalidatePath(`/instructor/courses/${id_}/edit`)
    return { success: true, data: null }
  } catch (error) {
    console.error("Record review check error:", error)
    return { success: false, error: "Failed to record the check" }
  }
}

export type AdminReviewCheckView = {
  key: ReviewCheckKey
  status: ReviewCheckStatus | null
  note: string | null
  at: string | null
  byName: string | null
  /** Recorded on an earlier version of the content, so it no longer counts. */
  stale: boolean
}
export type AdminCourseReview = {
  id: string
  /** The content fingerprint this page loaded; sent back with each record and the approval. */
  fingerprint: string
  title: string
  format: CourseFormat
  status: CourseStatus
  pricing: CoursePricing
  price: number
  creator: { name: string; email: string | null }
  review: { status: CourseReviewStatus; submittedAt: string | null; note: string | null }
  checks: AdminReviewCheckView[] // REVIEW_CHECKS order
  outstanding: ReviewCheckKey[]
  lessons: { id: string; title: string; type: LessonType; durationSec: number | null; isFree: boolean }[]
  productFile: { typeLabel: string; sizeBytes: number } | null
}

/** Everything the review page shows. Null for anything but a marketplace course, or for a non-admin. */
export async function adminGetCourseReview(courseId: string): Promise<AdminCourseReview | null> {
  try {
    await connectDB()
    await requireAdmin()

    const id = CourseId.safeParse(courseId)
    if (!id.success) return null
    const course = await Course.findOne({ _id: id.data, kind: "marketplace" })
      .select("title kind format status pricing price instructor review productFile")
      .populate("instructor", "firstName lastName email")
      .lean()
    if (!course) return null

    const [fingerprint, lessons] = await Promise.all([
      courseReviewFingerprint(id.data),
      Lesson.find({ course: course._id }).sort({ order: 1 }).select("title type videoDuration isFree").lean(),
    ])

    const stored = course.review?.checks ?? {}
    const byIds = REVIEW_CHECKS.flatMap((k) => {
      const by = stored[k]?.by
      return by ? [by.toString()] : []
    })
    const reviewers = byIds.length
      ? await User.find({ _id: { $in: byIds } }).select("firstName lastName").lean()
      : []
    const nameById = new Map(
      reviewers.map((u) => [u._id.toString(), `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "An admin"])
    )

    const owner = course.instructor as unknown as { firstName?: string; lastName?: string; email?: string } | null
    const format = courseFormatOf(course) ?? "course"
    return {
      id: course._id.toString(),
      fingerprint: fingerprint ?? "",
      title: course.title,
      format,
      status: course.status,
      pricing: course.pricing,
      price: course.price ?? 0,
      creator: {
        name: `${owner?.firstName ?? ""} ${owner?.lastName ?? ""}`.trim() || "A Marketplace Creator",
        email: owner?.email && !owner.email.endsWith("@users.noemail") ? owner.email : null,
      },
      review: {
        status: course.review?.status ?? "none",
        submittedAt: course.review?.submittedAt ? new Date(course.review.submittedAt).toISOString() : null,
        note: course.review?.note ?? null,
      },
      checks: REVIEW_CHECKS.map((key) => {
        const c = stored[key]
        const recorded = c?.status ?? null
        return {
          key,
          status: recorded,
          note: c?.note ?? null,
          at: c?.at ? new Date(c.at).toISOString() : null,
          byName: c?.by ? (nameById.get(c.by.toString()) ?? null) : null,
          stale: recorded !== null && c?.contentHash !== fingerprint,
        }
      }),
      outstanding: fingerprint ? outstandingChecks(stored, fingerprint) : [...REVIEW_CHECKS],
      lessons: lessons.map((l) => ({
        id: l._id.toString(),
        title: l.title,
        type: l.type,
        durationSec: l.videoDuration ?? null,
        isFree: Boolean(l.isFree),
      })),
      productFile:
        isFileFormat(format) && course.productFile
          ? { typeLabel: productTypeLabel(course.productFile.mimeType), sizeBytes: course.productFile.sizeBytes }
          : null,
    }
  } catch (error) {
    console.error("Get course review error:", error)
    return null
  }
}
