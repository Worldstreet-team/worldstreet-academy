"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Course, Lesson, User } from "@/lib/db/models"
import { requireAdmin } from "@/lib/auth/admin"
import { notifyUser } from "@/lib/notify"
import { sendCourseReviewDecisionEmail } from "@/lib/email"
import { appUrl } from "@/lib/app-url"
import { courseFormatOf, hasDeliverable, isFileFormat } from "@/lib/course-format"
import { courseReviewFingerprint } from "@/lib/course-review"
import { REVIEW_CHECK_DETAILS, outstandingChecks } from "@/lib/review-checks"

/**
 * The marketplace quality review, admin side (owner, 2026-10-05). A seller
 * submits a draft marketplace course (lib/course-review.ts); here an admin
 * approves it — it is published — or requests changes with a note, and the
 * course stays a draft. Both tell the seller in the app and by email.
 * Faculty marketplace courses never come through here: they publish directly.
 */

type Result = { success: true; data: null } | { success: false; error: string }

const CourseId = z.string().regex(/^[a-f0-9]{24}$/, "Invalid course")

const ChangesInput = z.object({
  courseId: CourseId,
  note: z
    .string()
    .trim()
    .min(5, "Tell the seller what to change (at least 5 characters)")
    .max(2000, "Keep the note to 2,000 characters"),
})

async function sellerContact(userId: string) {
  return User.findById(userId).select("email firstName").lean()
}

/** Approve: review "approved", the course and its lessons published, publishedAt stamped once. */
export async function adminApproveCourseReview(courseId: string): Promise<Result> {
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
    const outstanding = fingerprint ? outstandingChecks(course.review?.checks, fingerprint) : null
    if (!outstanding || outstanding.length > 0) {
      return {
        success: false,
        error: `Every check must pass first. Still to do: ${(outstanding ?? ["content", "quality", "accuracy", "technical"] as const).map((k) => REVIEW_CHECK_DETAILS[k].title).join(", ")}`,
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

/** Request changes: review "changes_requested" with the note; the course stays a draft. */
export async function adminRequestCourseChanges(courseId: string, note: string): Promise<Result> {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const parsed = ChangesInput.safeParse({ courseId, note })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }

    const course = await Course.findOneAndUpdate(
      { _id: parsed.data.courseId, kind: "marketplace", "review.status": "pending" },
      {
        $set: {
          "review.status": "changes_requested",
          "review.reviewedAt": new Date(),
          "review.reviewedBy": admin.id,
          "review.note": parsed.data.note,
        },
      },
      { new: true }
    )
      .select("title instructor")
      .lean()
    if (!course) return { success: false, error: "This course isn't waiting for review" }

    const id_ = course._id.toString()
    void notifyUser(course.instructor.toString(), {
      type: "course",
      title: `Changes requested: ${course.title}`.slice(0, 120),
      body: parsed.data.note.slice(0, 500),
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
        note: parsed.data.note,
        ctaUrl: appUrl(`/instructor/courses/${id_}/edit`),
      })
    }

    revalidatePath("/admin/courses")
    revalidatePath("/instructor/courses")
    revalidatePath(`/instructor/courses/${id_}/edit`)
    return { success: true, data: null }
  } catch (error) {
    console.error("Request course changes error:", error)
    return { success: false, error: "Failed to request changes" }
  }
}
