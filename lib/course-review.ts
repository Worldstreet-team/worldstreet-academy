import "server-only"
import { createHash } from "node:crypto"
import { Course, Lesson, Resource, User } from "@/lib/db/models"
import { courseFormatOf } from "@/lib/course-format"
import { EMPTY_CHECK, REVIEW_CHECKS, outstandingChecks, reviewContentString } from "@/lib/review-checks"
import { notifyAdmins } from "@/lib/notify"
import { sendCourseReviewAdminEmail } from "@/lib/email"
import { appUrl } from "@/lib/app-url"

/** Where admins review marketplace courses. */
export const REVIEW_QUEUE_PATH = "/admin/courses?review=pending"

/**
 * The content fingerprint the four quality checks are recorded against (ruling
 * 7): SHA-256 over the reviewable course fields, its lessons in order (without
 * ids, because the editor recreates lessons on every save) and the product
 * file's key. Null when the course doesn't exist. Callers have run connectDB().
 */
export async function courseReviewFingerprint(courseId: string): Promise<string | null> {
  const [course, lessons, resources] = await Promise.all([
    Course.findById(courseId)
      .select("title shortDescription description thumbnailUrl level school kind format pricing price whatYouWillLearn communityUrl productFile")
      .lean(),
    Lesson.find({ course: courseId })
      .sort({ order: 1 })
      .select("title description type videoUrl content videoDuration isFree sectionTitle")
      .lean(),
    Resource.find({ course: courseId })
      .sort({ order: 1, title: 1, _id: 1 })
      .select("title kind storageKey externalUrl filename sizeBytes isFree lesson")
      .lean(),
  ])
  if (!course) return null
  const content = reviewContentString({
    title: course.title,
    shortDescription: course.shortDescription,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    level: course.level,
    school: course.school,
    format: courseFormatOf(course),
    pricing: course.pricing,
    price: course.price,
    whatYouWillLearn: course.whatYouWillLearn,
    communityUrl: course.communityUrl,
    productFileKey: course.productFile?.key ?? null,
    lessons,
    resources: resources.map((r) => ({
      title: r.title,
      kind: r.kind,
      storageKey: r.storageKey,
      externalUrl: r.externalUrl,
      filename: r.filename,
      sizeBytes: r.sizeBytes,
      isFree: r.isFree,
      lessonIndex: r.lesson ? lessons.findIndex((l) => l._id.toString() === r.lesson?.toString()) : null,
    })),
  })
  return createHash("sha256").update(content).digest("hex")
}

/**
 * Why a course can't be published outside its review page, or null when it
 * may be (ruling 9). Only a Marketplace Creator's course (owner role `USER`) is
 * gated: its approval must stand AND all four checks must be cleared on the
 * content as it is now, so a course taken back to draft and edited can't go
 * live on its old approval. Faculty-owned courses publish directly. Callers
 * have run connectDB() and only ask about marketplace courses.
 */
export async function creatorPublishRefusal(course: {
  _id: { toString(): string }
  instructor: { toString(): string }
  review?: { status?: string | null; checks?: Parameters<typeof outstandingChecks>[0] } | null
}): Promise<string | null> {
  const owner = await User.findById(course.instructor).select("role").lean()
  if (owner?.role !== "USER") return null
  if (course.review?.status !== "approved") {
    return "A Marketplace Creator's course is published from its review page, once all four checks pass."
  }
  const fingerprint = await courseReviewFingerprint(course._id.toString())
  if (!fingerprint || outstandingChecks(course.review.checks, fingerprint).length > 0) {
    return "This course changed since its review and needs re-checking. The Marketplace Creator submits it for review again, and it is published from its review page."
  }
  return null
}

/**
 * The checks a (re-)submission resets: every one that isn't cleared on the
 * current content (ruling 7). A cleared check on an unchanged fingerprint
 * stays. Returns the `$set` entries that blank them.
 */
async function resetChecks(courseId: string): Promise<Record<string, typeof EMPTY_CHECK>> {
  const [current, fingerprint] = await Promise.all([
    Course.findById(courseId).select("review.checks").lean(),
    courseReviewFingerprint(courseId),
  ])
  const reset = fingerprint ? outstandingChecks(current?.review?.checks, fingerprint) : [...REVIEW_CHECKS]
  return Object.fromEntries(reset.map((key) => [`review.checks.${key}`, EMPTY_CHECK]))
}

/**
 * A seller saved changes to a course that is already live. It stays live (its
 * buyers keep learning), but the review goes back to "pending" so an admin
 * re-checks the new content, and the admins are told. The price can't change
 * on a live course at all (updateCourse refuses it). The four quality checks
 * that aren't cleared on the current content are reset; the ones that are stay
 * (ruling 7). Returns false when the course isn't the seller's live
 * marketplace course.
 */
export async function requestLiveCourseReview(
  courseId: string,
  seller: { id: string; name: string; avatarUrl?: string | null }
): Promise<boolean> {
  const reset = await resetChecks(courseId)
  const course = await Course.findOneAndUpdate(
    { _id: courseId, instructor: seller.id, kind: "marketplace", status: "published" },
    {
      $set: {
        ...reset,
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
 * false when nothing changed. The four quality checks that aren't cleared on
 * the current content are reset (ruling 7); an unchanged re-submission keeps
 * its passes. Callers have run connectDB() and checked that
 * `seller` is the signed-in user.
 */
export async function requestCourseReview(
  courseId: string,
  seller: { id: string; name: string; avatarUrl?: string | null }
): Promise<boolean> {
  const reset = await resetChecks(courseId)
  const course = await Course.findOneAndUpdate(
    {
      _id: courseId,
      instructor: seller.id,
      kind: "marketplace",
      status: { $ne: "published" },
      "review.status": { $ne: "pending" },
    },
    { $set: { ...reset, "review.status": "pending", "review.submittedAt": new Date() } },
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
