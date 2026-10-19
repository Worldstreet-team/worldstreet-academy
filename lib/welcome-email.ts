import "server-only"

import { connectDB } from "@/lib/db"
import { Course, Enrollment, User } from "@/lib/db/models"
import { sendWelcomeEmail } from "@/lib/email"
import { cohortDateLabel } from "@/lib/cohort"
import { cohortsForEnrollments } from "@/lib/cohort-calendar"
import { courseKindOf } from "@/lib/course-kind"

/**
 * The one-time welcome to the WMA Student Portal (blueprint §10, D27).
 * Fire-and-forget like `lib/notify.ts`: call it with `void` after the
 * enrollment's own confirmation email, and it never throws into the purchase.
 *
 * It goes on a learner's first PAID enrollment only, checked in the data
 * (phase 15 ruling 11). A bare `welcomedAt` claim is not enough: every user
 * created before this release lacks the field, so their next purchase would
 * claim it. So an earlier paid enrollment of theirs means this is not the
 * first, and nothing is sent. The claim itself is one atomic update, so two
 * simultaneous first purchases send exactly one, and it is never released:
 * a failed send is not retried (the per-program confirmation already carries
 * the sign-in line).
 */
export async function sendWelcomeOnce(userId: string, enrollmentId: string): Promise<void> {
  try {
    await connectDB()

    const current = await Enrollment.findOne({ _id: enrollmentId, user: userId })
      .select("pricePaid purchasedAt createdAt status course")
      .lean()
    if (!current || !(current.pricePaid > 0)) return

    const cutoff = current.purchasedAt ?? new Date()
    const earlierPaid = await Enrollment.exists({
      user: userId,
      _id: { $ne: enrollmentId },
      pricePaid: { $gt: 0 },
      $or: [{ purchasedAt: { $lt: cutoff } }, { purchasedAt: null }],
    })
    if (earlierPaid) return

    // `null` also matches a missing field; the filter is the atomic claim.
    const claim = await User.updateOne({ _id: userId, welcomedAt: null }, { $set: { welcomedAt: new Date() } })
    if (claim.modifiedCount !== 1) return
    console.info("[Welcome] claimed", userId)

    const user = await User.findById(userId).select("email firstName").lean()
    if (!user?.email) return

    // The learner's own cohort (Phase 12 rulings 2–3), named only while it is still ahead.
    const course = await Course.findById(current.course).select("kind").lean()
    const placed =
      course && courseKindOf(course) === "program" && (current.status === "active" || current.status === "completed")
        ? ((await cohortsForEnrollments([current])).get(String(current._id)) ?? null)
        : null

    await sendWelcomeEmail({
      to: user.email,
      firstName: user.firstName ?? "",
      cohortStartLabel: placed && Date.parse(placed.startsAt) > Date.now() ? cohortDateLabel(placed.startsAt) : null,
    })
  } catch (err) {
    console.error("[Welcome] failed:", err)
  }
}
