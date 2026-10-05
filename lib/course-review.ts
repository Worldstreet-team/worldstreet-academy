import "server-only"
import { Course, User } from "@/lib/db/models"
import { notifyAdmins } from "@/lib/notify"
import { sendCourseReviewAdminEmail } from "@/lib/email"
import { appUrl } from "@/lib/app-url"

/** Where admins review marketplace courses. */
export const REVIEW_QUEUE_PATH = "/admin/courses?review=pending"

/**
 * A seller saved changes to a course that is already live. It stays live (its
 * buyers keep learning), but the review goes back to "pending" so an admin
 * re-checks the new content, and the admins are told. The price can't change
 * on a live course at all (updateCourse refuses it). Returns false when the
 * course isn't the seller's live marketplace course.
 */
export async function requestLiveCourseReview(
  courseId: string,
  seller: { id: string; name: string; avatarUrl?: string | null }
): Promise<boolean> {
  const course = await Course.findOneAndUpdate(
    { _id: courseId, instructor: seller.id, kind: "marketplace", status: "published" },
    {
      $set: {
        "review.status": "pending",
        "review.submittedAt": new Date(),
        "review.note": "Edited while live — check the changes",
      },
    },
    { new: true }
  )
    .select("title")
    .lean()
  if (!course) return false
  void notifyAdmins({
    type: "course",
    title: "Live marketplace course edited",
    body: `${seller.name} changed “${course.title}” while it is live — please re-check it.`.slice(0, 500),
    href: REVIEW_QUEUE_PATH,
    courseId,
  })
  return true
}

/**
 * Put a seller's marketplace course in the review queue (owner, 2026-10-05:
 * every marketplace course passes a quality review before it is published)
 * and tell the admins — in the app and by email. Only the seller's own
 * marketplace course, only while it isn't live or already queued; returns
 * false when nothing changed. Callers have run connectDB() and checked that
 * `seller` is the signed-in user.
 */
export async function requestCourseReview(
  courseId: string,
  seller: { id: string; name: string; avatarUrl?: string | null }
): Promise<boolean> {
  const course = await Course.findOneAndUpdate(
    {
      _id: courseId,
      instructor: seller.id,
      kind: "marketplace",
      status: { $ne: "published" },
      "review.status": { $ne: "pending" },
    },
    { $set: { "review.status": "pending", "review.submittedAt": new Date() } },
    { new: true }
  )
    .select("title")
    .lean()
  if (!course) return false

  void notifyAdmins({
    type: "course",
    title: "Marketplace course to review",
    body: `${seller.name} submitted “${course.title}”.`.slice(0, 500),
    href: REVIEW_QUEUE_PATH,
    courseId,
  })
  void (async () => {
    const admins = await User.find({ role: "ADMIN" }).select("email").lean()
    await Promise.allSettled(
      admins
        .filter((a) => a.email && !a.email.endsWith("@users.noemail"))
        .map((a) =>
          sendCourseReviewAdminEmail(a.email, {
            sellerName: seller.name,
            sellerAvatarUrl: seller.avatarUrl ?? undefined,
            courseTitle: course.title,
            reviewUrl: appUrl(REVIEW_QUEUE_PATH),
          })
        )
    )
  })()
  return true
}
