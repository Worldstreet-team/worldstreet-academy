import "server-only"
import type { Types } from "mongoose"
import {
  AccessGrant,
  Assignment,
  Attendance,
  Bookmark,
  Course,
  Earning,
  Enrollment,
  EnrollmentIntent,
  Exam,
  ExamAttempt,
  Lesson,
  ManualPayment,
  Meeting,
  MentorshipSession,
  Order,
  PaymentEvent,
  PointEvent,
  Question,
  Recording,
  Resource,
  ResourceDownload,
  Review,
  Submission,
  User,
  WatchProgress,
} from "@/lib/db/models"

/*
 * The one rule for "may this course be deleted?" (2026-11-11), shared by the
 * admin delete and the instructor delete. A course anyone has enrolled in or
 * paid for is never deleted: learners keep their records and the money trail
 * keeps its course. Such a course is hidden instead (status "archived").
 * Never a "use server" module: callers check the user and the id first.
 */

/**
 * A course still on the website is never deleted (review, 2026-11-11).
 * Checkout reads a course as "published" before it charges, so a delete that
 * raced an in-flight purchase could leave a paid order on a missing course.
 * Taking it off the website first (hidden, draft, suspended or closed) closes
 * that window: no new checkout can start on it.
 */
export function isLiveOnWebsite(status: string | null | undefined): boolean {
  return status === "published"
}

type Blocker = { count: number; one: string; many: string }

function plural({ count, one, many }: Blocker): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`
}

/**
 * Why this course can't be deleted, as one sentence, or null when no learner
 * or money record points at it. Enrollments count in any status (a refund or
 * a free pre-enrolment is still a learner's record); the payment log is
 * matched by the course id its events carry.
 */
export async function courseDeletionRefusal(courseId: Types.ObjectId): Promise<string | null> {
  const course = courseId
  const [
    enrollments,
    orders,
    paymentEvents,
    earnings,
    transfers,
    grants,
    attempts,
    submissions,
    mentorship,
    attendance,
    points,
  ] = await Promise.all([
    Enrollment.countDocuments({ course }),
    Order.countDocuments({ course }),
    PaymentEvent.countDocuments({ "payload.courseId": { $in: [course.toString(), course] } }),
    Earning.countDocuments({ course }),
    ManualPayment.countDocuments({ course }),
    AccessGrant.countDocuments({ course }),
    ExamAttempt.countDocuments({ course }),
    Submission.countDocuments({ course }),
    MentorshipSession.countDocuments({ course }),
    Attendance.countDocuments({ course }),
    PointEvent.countDocuments({ course }),
  ])

  const found: Blocker[] = [
    { count: enrollments, one: "enrollment", many: "enrollments" },
    { count: orders, one: "order", many: "orders" },
    // Every logged event belongs to an order; it only adds anything when no order is left.
    { count: orders > 0 ? 0 : paymentEvents, one: "payment record", many: "payment records" },
    { count: earnings, one: "earning", many: "earnings" },
    { count: transfers, one: "transfer receipt", many: "transfer receipts" },
    { count: grants, one: "recorded outside payment", many: "recorded outside payments" },
    { count: attempts, one: "exam attempt", many: "exam attempts" },
    { count: submissions, one: "assignment submission", many: "assignment submissions" },
    { count: mentorship, one: "mentorship request", many: "mentorship requests" },
    { count: attendance, one: "class attendance record", many: "class attendance records" },
    { count: points, one: "learning-points award", many: "learning-points awards" },
  ].filter((b) => b.count > 0)

  if (found.length === 0) return null
  const parts = found.map(plural)
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
  return `People have enrolled in or paid for it (${list}), so it can't be deleted.`
}

/**
 * Delete the course and the content that exists only for it, for both the
 * admin and the instructor delete (2026-11-11). The caller has already checked
 * the user, the id, isLiveOnWebsite and courseDeletionRefusal.
 *
 * A checkout that read the course just before it went may still open an order,
 * so the refusal runs again once the course is gone. If anything turned up (or
 * the re-check itself fails), the course goes back exactly as it was, with
 * nothing else removed yet. The refusal comes back as the result; null means
 * deleted. Storage objects (R2, Cloudinary) are the caller's to remove, and no
 * money or learner record is touched: none can exist past the check.
 */
export async function deleteCourseAndContent(
  /** The full raw document (a lean read): it is re-inserted as is when the delete is undone. */
  course: { _id: Types.ObjectId; instructor: Types.ObjectId }
): Promise<string | null> {
  // 2026-11-12: deleted only while still off the website. Another admin may have shown it
  // again since the caller's isLiveOnWebsite check, and a checkout could then start on it.
  // await Course.deleteOne({ _id: course._id })
  const deleted = await Course.deleteOne({ _id: course._id, status: { $ne: "published" } })
  if (deleted.deletedCount === 0) {
    return "It changed in the meantime (it may be live on the website again), so it wasn't deleted."
  }
  let lateRefusal: string | null
  try {
    lateRefusal = await courseDeletionRefusal(course._id)
  } catch (error) {
    await Course.collection.insertOne(course)
    throw error
  }
  if (lateRefusal) {
    await Course.collection.insertOne(course)
    return lateRefusal
  }

  const id = course._id
  try {
    const examIds = await Exam.find({ course: id }).distinct("_id")
    await Promise.all([
      Lesson.deleteMany({ course: id }),
      Question.deleteMany({ exam: { $in: examIds } }),
      Exam.deleteMany({ course: id }),
      Assignment.deleteMany({ course: id }),
      Resource.deleteMany({ course: id }),
      ResourceDownload.deleteMany({ course: id }),
      // Its classes: with no learner attendance or mentorship (the check), only the host's.
      Meeting.deleteMany({ courseId: id }),
      Recording.deleteMany({ course: id }),
      Review.deleteMany({ course: id }),
      Bookmark.deleteMany({ course: id }),
      WatchProgress.deleteMany({ course: id }),
      // A learner's saved school stays; only the program it named goes.
      EnrollmentIntent.updateMany({ course: id }, { $set: { course: null, packageKey: null } }),
    ])
  } catch (error) {
    // The course itself is gone; leftovers point at nothing and show nowhere.
    console.error("[Courses] cleanup after delete failed:", id.toString(), error)
  }

  // The owner's course count (createCourse adds one); faculty only, a seller keeps none.
  await User.updateOne(
    { _id: course.instructor, role: { $in: ["INSTRUCTOR", "ADMIN"] }, "instructorProfile.totalCourses": { $gt: 0 } },
    { $inc: { "instructorProfile.totalCourses": -1 } }
  )
  return null
}
