"use server"

import { Types } from "mongoose"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Course, Meeting, MentorshipSession, Recording, User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"

/*
 * The tutor's academic calendar (/instructor/calendar): the course classes
 * they host (scheduled, live, past, cancelled) and their confirmed mentorship
 * sessions, inside the range the browser asks for. Times leave as ISO — the
 * browser lays them out in its own time zone. Read-only: starting a class
 * still goes through joinMeeting and its early-start rule.
 */

/** A month grid is 6 weeks; allow a little slack, never an open-ended scan. */
const MAX_RANGE_MS = 62 * 24 * 3600_000
const ENTRY_LIMIT = 500
const HOST_MEETINGS_PATH = "/instructor/meetings"

export type CalendarEntry = {
  /** The Meeting _id. */
  id: string
  kind: "class" | "mentorship"
  title: string
  courseTitle: string
  /** Mentorship only. */
  studentName: string | null
  /** ISO — scheduled time, or the start of a class opened on the spot. */
  start: string
  /** ISO, once ended. */
  end: string | null
  state: "upcoming" | "live" | "ended" | "cancelled"
  /** The host's start/rejoin link while upcoming or live (joinMeeting still enforces the early-start rule). */
  joinHref: string | null
  /** Class recordings (mentorship is never recorded). Stored ones play; the rest are still copying or failed. */
  recordings: Array<{ id: string; title: string; status: "pending" | "stored" | "failed" }>
}

const rangeSchema = z
  .object({ from: z.iso.datetime(), to: z.iso.datetime() })
  .refine((r) => {
    const span = new Date(r.to).getTime() - new Date(r.from).getTime()
    return span > 0 && span <= MAX_RANGE_MS
  }, "Pick a shorter range")

type MeetingRow = {
  _id: Types.ObjectId
  title: string
  courseId?: Types.ObjectId
  mentorshipSessionId?: Types.ObjectId
  status: "scheduled" | "waiting" | "active" | "ended"
  scheduledAt?: Date
  startedAt?: Date
  endedAt?: Date
  createdAt: Date
}

function stateOf(m: MeetingRow): CalendarEntry["state"] {
  if (m.status === "active" || m.status === "waiting") return "live"
  if (m.status === "scheduled") return "upcoming"
  return m.startedAt ? "ended" : "cancelled"
}

export async function getTeachingCalendar(input: {
  from: string
  to: string
}): Promise<{ success: true; data: CalendarEntry[] } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") return { success: false, error: "Instructors only" }
    const parsed = rangeSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid range" }

    const from = new Date(parsed.data.from)
    const to = new Date(parsed.data.to)
    const hostId = new Types.ObjectId(user.id)
    const inRange = { $gte: from, $lt: to }

    // Only the caller's own rooms — scoped by hostId, never by an id from the browser.
    const meetings = await Meeting.find({
      hostId,
      $and: [
        { $or: [{ courseId: { $ne: null } }, { mentorshipSessionId: { $ne: null } }] },
        { $or: [{ scheduledAt: inRange }, { scheduledAt: null, startedAt: inRange }] },
      ],
    })
      .select("title courseId mentorshipSessionId status scheduledAt startedAt endedAt createdAt")
      .sort({ scheduledAt: 1, startedAt: 1 })
      .limit(ENTRY_LIMIT)
      .lean<MeetingRow[]>()

    const classes = meetings.filter((m) => m.courseId && !m.mentorshipSessionId)
    const sessionMeetings = meetings.filter((m) => m.mentorshipSessionId)

    const [sessions, recordings] = await Promise.all([
      sessionMeetings.length
        ? MentorshipSession.find({
            _id: { $in: sessionMeetings.flatMap((m) => (m.mentorshipSessionId ? [m.mentorshipSessionId] : [])) },
          })
            .select("status student course")
            .lean()
        : Promise.resolve([]),
      classes.length
        ? Recording.find({ meeting: { $in: classes.map((m) => m._id) } })
            .select("meeting title status recordedAt")
            .sort({ recordedAt: 1 })
            .lean()
        : Promise.resolve([]),
    ])
    const sessionById = new Map(sessions.map((s) => [s._id.toString(), s]))

    const courseIds = new Set<string>()
    for (const m of classes) if (m.courseId) courseIds.add(m.courseId.toString())
    for (const s of sessions) courseIds.add(s.course.toString())
    const [courses, students] = await Promise.all([
      courseIds.size ? Course.find({ _id: { $in: [...courseIds] } }).select("title").lean() : Promise.resolve([]),
      sessions.length
        ? User.find({ _id: { $in: sessions.map((s) => s.student) } }).select("firstName lastName").lean()
        : Promise.resolve([]),
    ])
    const courseTitle = new Map(courses.map((c) => [c._id.toString(), c.title]))
    const studentName = new Map(students.map((u) => [u._id.toString(), `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()]))
    const recordingsByMeeting = new Map<string, CalendarEntry["recordings"]>()
    for (const r of recordings) {
      const key = r.meeting.toString()
      recordingsByMeeting.set(key, [
        ...(recordingsByMeeting.get(key) ?? []),
        { id: r._id.toString(), title: r.title, status: r.status },
      ])
    }

    const entries: CalendarEntry[] = []
    for (const m of meetings) {
      const start = m.scheduledAt ?? m.startedAt ?? m.createdAt
      const state = stateOf(m)
      const id = m._id.toString()
      const joinHref = state === "upcoming" || state === "live" ? `${HOST_MEETINGS_PATH}?join=${id}` : null

      if (m.mentorshipSessionId) {
        const session = sessionById.get(m.mentorshipSessionId.toString())
        // A declined or cancelled booking leaves the calendar.
        if (!session || session.status !== "confirmed") continue
        entries.push({
          id,
          kind: "mentorship",
          title: "Mentorship session",
          courseTitle: courseTitle.get(session.course.toString()) ?? "",
          studentName: studentName.get(session.student.toString()) || "Student",
          start: start.toISOString(),
          end: m.endedAt?.toISOString() ?? null,
          state,
          joinHref,
          recordings: [],
        })
        continue
      }

      entries.push({
        id,
        kind: "class",
        title: m.title,
        courseTitle: (m.courseId && courseTitle.get(m.courseId.toString())) || "",
        studentName: null,
        start: start.toISOString(),
        end: m.endedAt?.toISOString() ?? null,
        state,
        joinHref,
        recordings: recordingsByMeeting.get(id) ?? [],
      })
    }

    entries.sort((a, b) => a.start.localeCompare(b.start))
    return { success: true, data: entries }
  } catch (error) {
    console.error("[Calendar] load failed:", error)
    return { success: false, error: "Couldn't load your calendar" }
  }
}
