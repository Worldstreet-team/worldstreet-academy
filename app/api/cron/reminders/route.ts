import { NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/db"
import { Meeting, User } from "@/lib/db/models"
import { notifyUser } from "@/lib/notify"
import { sendInterviewReminderEmail } from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://academy.worldstreetgold.com"

/**
 * Scheduled-meeting reminders — T-24h and T-1h, for interviews and any other
 * scheduled meeting. Idempotent via the per-meeting `reminders` ledger.
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

  const upcoming = await Meeting.find({
    status: "scheduled",
    scheduledAt: { $gt: new Date(now), $lte: new Date(now + 24 * 3600 * 1000) },
  }).limit(100)

  let sent24 = 0
  let sent1 = 0

  for (const meeting of upcoming) {
    if (!meeting.scheduledAt) continue
    const msLeft = meeting.scheduledAt.getTime() - now
    const window: "24h" | "1h" | null =
      msLeft <= 3600 * 1000 && !meeting.reminders?.h1SentAt
        ? "1h"
        : msLeft <= 24 * 3600 * 1000 && !meeting.reminders?.h24SentAt
          ? "24h"
          : null
    if (!window) continue

    const joinPath = `/dashboard/meetings?join=${meeting._id.toString()}`
    const when = meeting.scheduledAt

    // Recipients: host + everyone invited.
    const host = await User.findById(meeting.hostId).select("firstName lastName email").lean()
    const hostName = host ? `${host.firstName ?? ""} ${host.lastName ?? ""}`.trim() : "Host"
    const inviteeIds = (meeting.invites ?? [])
      .filter((i) => i.userId)
      .map((i) => i.userId!.toString())
    const invitees = inviteeIds.length
      ? await User.find({ _id: { $in: inviteeIds } }).select("firstName lastName email").lean()
      : []

    const title =
      window === "1h" ? "Starting in ~1 hour 🎙️" : "Reminder: scheduled for tomorrow"
    const bodyLine = `${meeting.title} — ${when.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`

    const jobs: Promise<unknown>[] = []
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
    await Promise.allSettled(jobs)

    // Mark the ledger AFTER sending — a crash mid-send re-sends rather than skips.
    await Meeting.updateOne(
      { _id: meeting._id },
      { $set: window === "1h" ? { "reminders.h1SentAt": new Date() } : { "reminders.h24SentAt": new Date() } }
    )
    if (window === "1h") sent1++
    else sent24++
  }

  return NextResponse.json({ ok: true, upcoming: upcoming.length, sent24, sent1 })
}
