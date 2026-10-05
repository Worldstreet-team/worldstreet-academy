import "server-only"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Course, Enrollment, Meeting, User } from "@/lib/db/models"
import { entitlementsFor } from "@/lib/entitlements"
import { notifyUsers } from "@/lib/notify"
import { sendMeetingNotificationEmail } from "@/lib/email"
import { APP_URL } from "@/lib/app-url"

/**
 * "<Course> is live now — join your class": a bell + Ably event (and, when
 * `email` is set, the "Happening right now" class email) to every student
 * whose active/completed enrollment includes live classes — the audience
 * createCourseMeeting's email and the reminders cron use, and the one
 * joinMeeting lets in.
 *
 * Idempotent per class: `Meeting.liveNotifiedAt` is claimed with a filtered
 * findOneAndUpdate BEFORE anything is sent, so a host rejoining (or two
 * racing joins) never re-notifies. A crash mid-send leaves some students
 * un-notified rather than notifying everyone twice — the course-live cron's
 * trade-off. Mentorship sessions and other non-class meetings never match the
 * claim. Never throws: callers fire and forget.
 */
export async function announceClassLive(meetingId: string, opts: { email: boolean }): Promise<void> {
  try {
    if (!Types.ObjectId.isValid(meetingId)) return
    await connectDB()

    const meeting = await Meeting.findOneAndUpdate(
      {
        _id: new Types.ObjectId(meetingId),
        status: "active",
        courseId: { $ne: null },
        mentorshipSessionId: null,
        liveNotifiedAt: null,
      },
      { $set: { liveNotifiedAt: new Date() } },
      { new: true }
    )
      .select("title hostId courseId")
      .lean()
    if (!meeting?.courseId) return

    const [course, enrollments, host] = await Promise.all([
      Course.findById(meeting.courseId).select("title packages thumbnailUrl").lean(),
      Enrollment.find({ course: meeting.courseId, status: { $in: ["active", "completed"] } })
        .select("user packageKey")
        .lean(),
      User.findById(meeting.hostId).select("firstName lastName avatarUrl").lean(),
    ])
    if (!course) return

    const hostId = meeting.hostId.toString()
    const studentIds = [
      ...new Set(
        enrollments
          .filter((e) => entitlementsFor(course, e).liveClasses)
          .map((e) => e.user.toString())
          .filter((id) => id !== hostId)
      ),
    ]
    if (studentIds.length === 0) return

    const joinPath = `/dashboard/meetings?join=${meetingId}`
    const hostName = host ? `${host.firstName ?? ""} ${host.lastName ?? ""}`.trim() || "Your instructor" : "Your instructor"

    await notifyUsers(studentIds, {
      type: "meeting",
      title: `${course.title} is live now — join your class`,
      body: `${meeting.title} with ${hostName}`,
      href: joinPath,
      courseId: meeting.courseId.toString(),
      meta: { meetingId },
    })

    if (!opts.email) return
    const students = await User.find({ _id: { $in: studentIds } }).select("email").lean()
    await Promise.allSettled(
      students
        .filter((s) => s.email && !s.email.endsWith("@users.noemail"))
        .map((s) =>
          sendMeetingNotificationEmail(s.email, {
            meetingTitle: meeting.title,
            hostName,
            hostAvatarUrl: host?.avatarUrl || undefined,
            meetingLink: `${APP_URL}${joinPath}`,
            courseName: course.title,
            courseThumbnailUrl: course.thumbnailUrl || undefined,
          })
        )
    )
  } catch (error) {
    console.error("[ClassLive] announcement failed:", meetingId, error)
  }
}
