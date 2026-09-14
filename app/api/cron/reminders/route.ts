import { NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/db"
import { Course, Enrollment, Meeting, User } from "@/lib/db/models"
import { notifyUser } from "@/lib/notify"
import { formatUtcDateTime, sendClassReminderEmail, sendInterviewReminderEmail, sendMentorshipEmail } from "@/lib/email"
import { entitlementsFor } from "@/lib/entitlements"
import { APP_URL } from "@/lib/app-url"

/**
 * Where a class reminder sends its host: the instructor page, which starts the
 * class on request. Never the auto-joining student link — that would try to open
 * the room from a reminder tapped a day early.
 */
const HOST_CLASS_PATH = "/instructor/meetings"

/**
 * Scheduled-meeting reminders — T-24h and T-1h. Idempotent via the per-meeting
 * `reminders` ledger.
 *
 * - Course classes (meeting.courseId): the host, invitees, and every student
 *   whose active/completed enrollment's package includes live classes — the
 *   same audience that may join (joinMeeting) — with class wording.
 * - Mentorship sessions (meeting.mentorshipSessionId): the host and the invited
 *   student only, session wording.
 * - Every other scheduled meeting (instructor interviews): host + invitees,
 *   interview wording, exactly as before.
 *
 * Coolify scheduled task (~every 10 min):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://academy.worldstreetgold.com/api/cron/reminders
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization") ?? ""
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  await connectDB()
  const now = Date.now()

  // Soonest first, and only meetings with a reminder still unsent — meetings
  // already fully reminded can't crowd a due one past the limit.
  const upcoming = await Meeting.find({
    status: "scheduled",
    scheduledAt: { $gt: new Date(now), $lte: new Date(now + 24 * 3600 * 1000) },
    $or: [{ "reminders.h1SentAt": null }, { "reminders.h24SentAt": null }],
  })
    .sort({ scheduledAt: 1 })
    .limit(100)

  let sent24 = 0
  let sent1 = 0

  for (const meeting of upcoming) {
    try {
      if (!meeting.scheduledAt) continue
      const msLeft = meeting.scheduledAt.getTime() - now
      // Once under an hour, only the 1h reminder can fire — a late-scheduled class never gets "tomorrow".
      const window: "24h" | "1h" | null =
        msLeft <= 3600 * 1000 && !meeting.reminders?.h1SentAt
          ? "1h"
          : msLeft > 3600 * 1000 && msLeft <= 24 * 3600 * 1000 && !meeting.reminders?.h24SentAt
            ? "24h"
            : null
      if (!window) continue

      const joinPath = `/dashboard/meetings?join=${meeting._id.toString()}`
      const when = meeting.scheduledAt

      const host = await User.findById(meeting.hostId).select("firstName lastName email").lean()
      const hostName = host ? `${host.firstName ?? ""} ${host.lastName ?? ""}`.trim() : "Host"
      const inviteeIds = (meeting.invites ?? [])
        .filter((i) => i.userId)
        .map((i) => i.userId!.toString())

      // A class first seen in the 24h window may well be later today — never "tomorrow".
      const title =
        window === "1h"
          ? "Starting in ~1 hour"
          : meeting.mentorshipSessionId
            ? "Mentorship session coming up"
            : meeting.courseId
              ? "Class coming up"
              : "Reminder: scheduled for tomorrow"
      // Rendered on the server (UTC in Docker), so the time names its zone.
      const bodyLine = `${meeting.title} — ${formatUtcDateTime(when)}`

      const jobs: Promise<unknown>[] = []

      if (meeting.mentorshipSessionId) {
        // Mentorship session: the host and the invited student — never a course audience.
        const hostId = meeting.hostId.toString()
        const recipients = await User.find({ _id: { $in: [...new Set([hostId, ...inviteeIds])] } })
          .select("firstName email")
          .lean()
        const whenFull = formatUtcDateTime(when, "full")

        for (const recipient of recipients) {
          const recipientId = recipient._id.toString()
          const isHost = recipientId === hostId
          const href = isHost ? HOST_CLASS_PATH : joinPath
          jobs.push(notifyUser(recipientId, { type: "meeting", title, body: bodyLine, href }))
          if (recipient.email && !recipient.email.endsWith("@users.noemail")) {
            jobs.push(
              sendMentorshipEmail(recipient.email, {
                subject:
                  window === "1h"
                    ? "Your mentorship session starts in about an hour"
                    : "Reminder: your mentorship session is coming up",
                title: window === "1h" ? "Session starting soon" : "Session coming up",
                bodyText: isHost
                  ? `${recipient.firstName || "Hi"}, ${meeting.title} is scheduled for ${whenFull}. Start it from Meetings — your student can join once you're in.`
                  : `${recipient.firstName || "Hi"}, your private session with ${hostName} is scheduled for ${whenFull}. You can join as soon as your mentor starts it.`,
                ctaLabel: isHost ? "Open meetings" : "View session",
                ctaUrl: `${APP_URL}${href}`,
                recipientName: recipient.firstName || undefined,
              })
            )
          }
        }
      } else if (meeting.courseId) {
        // Course class: host + invitees + students whose package includes live classes.
        const [course, enrollments] = await Promise.all([
          Course.findById(meeting.courseId).select("title packages").lean(),
          Enrollment.find({ course: meeting.courseId, status: { $in: ["active", "completed"] } })
            .select("user packageKey")
            .lean(),
        ])
        const studentIds = course
          ? enrollments.filter((e) => entitlementsFor(course, e).liveClasses).map((e) => e.user.toString())
          : []
        const hostId = meeting.hostId.toString()
        const recipientIds = [...new Set([hostId, ...inviteeIds, ...studentIds])]
        const recipients = await User.find({ _id: { $in: recipientIds } }).select("firstName email").lean()

        for (const recipient of recipients) {
          const recipientId = recipient._id.toString()
          const isHost = recipientId === hostId
          const href = isHost ? HOST_CLASS_PATH : joinPath
          jobs.push(notifyUser(recipientId, { type: "meeting", title, body: bodyLine, href }))
          if (recipient.email && !recipient.email.endsWith("@users.noemail")) {
            jobs.push(
              sendClassReminderEmail(recipient.email, {
                recipientName: recipient.firstName || "there",
                classTitle: meeting.title,
                courseTitle: course?.title ?? null,
                hostName,
                isHost,
                scheduledAt: when.toISOString(),
                joinUrl: `${APP_URL}${href}`,
                window,
              })
            )
          }
        }
      } else {
        // Interview (or any other scheduled meeting): host + everyone invited.
        const invitees = inviteeIds.length
          ? await User.find({ _id: { $in: inviteeIds } }).select("firstName lastName email").lean()
          : []

        // Host bell (+ email for interview meetings)
        jobs.push(notifyUser(meeting.hostId.toString(), { type: "meeting", title, body: bodyLine, href: joinPath }))
        if (host?.email && !host.email.endsWith("@users.noemail")) {
          jobs.push(
            sendInterviewReminderEmail(host.email, {
              recipientName: host.firstName || "there",
              counterpartName: invitees[0]
                ? `${invitees[0].firstName ?? ""} ${invitees[0].lastName ?? ""}`.trim()
                : "your participant",
              scheduledAt: when.toISOString(),
              joinUrl: `${APP_URL}${joinPath}`,
              window,
            })
          )
        }
        // Invitees
        for (const inv of invitees) {
          jobs.push(notifyUser(inv._id.toString(), { type: "meeting", title, body: bodyLine, href: joinPath }))
          if (inv.email && !inv.email.endsWith("@users.noemail")) {
            jobs.push(
              sendInterviewReminderEmail(inv.email, {
                recipientName: inv.firstName || "there",
                counterpartName: hostName,
                scheduledAt: when.toISOString(),
                joinUrl: `${APP_URL}${joinPath}`,
                window,
              })
            )
          }
        }
      }

      await Promise.allSettled(jobs)

      // Mark the ledger AFTER sending — a crash mid-send re-sends rather than skips.
      await Meeting.updateOne(
        { _id: meeting._id },
        { $set: window === "1h" ? { "reminders.h1SentAt": new Date() } : { "reminders.h24SentAt": new Date() } }
      )
      if (window === "1h") sent1++
      else sent24++
    } catch (error) {
      console.error("[cron/reminders] meeting", meeting._id.toString(), error)
    }
  }

  return NextResponse.json({ ok: true, upcoming: upcoming.length, sent24, sent1 })
}
