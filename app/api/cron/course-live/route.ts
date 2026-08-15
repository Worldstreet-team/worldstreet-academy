import { NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/db"
import { Course, Enrollment } from "@/lib/db/models"
import { sendCourseLiveEmail } from "@/lib/email"
import { notifyUser } from "@/lib/notify"

/**
 * Course go-live announcements.
 *
 * The live FLIP itself needs no cron — availability is derived from
 * availableAt at read time, so pages switch on their own. What can't derive
 * itself is the outbound announcement: this route finds published courses
 * whose availability instant has passed and that haven't been announced,
 * emails + bells every pre-enrolled customer, and stamps liveNotifiedAt so
 * the batch is idempotent.
 *
 * Wire it as a Coolify scheduled task (~every 5 min):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://academy.worldstreetgold.com/api/cron/course-live
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization") ?? ""
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  await connectDB()

  // Stamp FIRST, then send: if a batch crashes mid-send some customers miss
  // one email, which beats double-announcing everyone on the retry.
  const now = new Date()
  const dueCourses = await Course.find({
    status: "published",
    availableAt: { $ne: null, $lte: now },
    liveNotifiedAt: null,
  })
    .select("title pricing price")
    .limit(20)

  let coursesAnnounced = 0
  let emailsSent = 0
  let emailsFailed = 0

  for (const course of dueCourses) {
    const claimed = await Course.findOneAndUpdate(
      { _id: course._id, liveNotifiedAt: null },
      { $set: { liveNotifiedAt: now } },
      { new: true }
    )
    if (!claimed) continue // another cron run claimed this course
    coursesAnnounced++

    const preEnrolled = await Enrollment.find({
      course: course._id,
      status: "pre_enrolled",
    })
      .populate("user", "email firstName")
      .lean()

    for (const enrollment of preEnrolled) {
      const user = enrollment.user as unknown as {
        _id: { toString(): string }
        email?: string
        firstName?: string
      } | null
      if (!user) continue

      const res = await sendCourseLiveEmail({
        to: user.email ?? "",
        firstName: user.firstName ?? "",
        courseTitle: course.title,
        courseId: course._id.toString(),
        isPaid: course.pricing === "paid",
        price: course.price ?? 0,
      })
      if (res.success) emailsSent++
      else emailsFailed++

      await notifyUser(user._id.toString(), {
        type: "course",
        title: "Your course is now live",
        body: `"${course.title}" just went live — your seat is reserved.`,
        href: `/dashboard/courses/${course._id.toString()}`,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    coursesAnnounced,
    emailsSent,
    emailsFailed,
  })
}
