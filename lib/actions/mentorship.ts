"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import {
  Course,
  Enrollment,
  Meeting,
  MentorshipSession,
  User,
  type MentorshipSessionStatus,
} from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { getCourseAccess } from "@/lib/course-access"
import { includesMentorship } from "@/lib/entitlements"
import { notifyUser } from "@/lib/notify"
import { formatUtcDateTime, sendMentorshipEmail } from "@/lib/email"
import { APP_URL } from "@/lib/app-url"

/*
 * Executive mentorship (spec §6): the student proposes times, the course
 * instructor confirms one (→ a private scheduled Meeting), either side can
 * cancel, and the instructor keeps a plain-text roadmap on the enrollment.
 * Who qualifies is `includesMentorship` over `getCourseAccess` — never inline.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/
/** A proposed time must leave the instructor at least this long to answer. */
const MIN_LEAD_MS = 60 * 60_000
/** Nobody books further out than this. */
const MAX_AHEAD_MS = 60 * 24 * 3600_000
/** A confirmed session the host never started reads "upcoming" this long past its time, then "past". */
const SESSION_GRACE_MS = 2 * 3600_000
const STUDENT_PATH = "/dashboard/mentorship"
const INSTRUCTOR_PATH = "/instructor/meetings"

/* ═══════════════════ shared ═══════════════════ */

export type MentorshipSessionView = {
  id: string
  courseId: string
  courseTitle: string
  studentName: string
  instructorName: string
  status: "requested" | "upcoming" | "past" | "declined" | "cancelled"
  /** ISO times the student proposed. */
  proposedSlots: string[]
  /** ISO — set once confirmed. */
  scheduledAt: string | null
  note: string
  responseNote: string
  /** Upcoming confirmed sessions: the meetings page's join link (it refuses politely before the host starts). */
  joinHref: string | null
}

type SessionLean = {
  _id: { toString(): string }
  student: { toString(): string }
  instructor: { toString(): string }
  course: { toString(): string }
  status: MentorshipSessionStatus
  proposedSlots: { at: Date }[]
  scheduledAt: Date | null
  note: string
  responseNote: string
  meetingId: { toString(): string } | null
}

function fullName(
  person: { firstName?: string | null; lastName?: string | null } | null | undefined,
  fallback: string
): string {
  const name = `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim()
  return name || fallback
}

/** Placeholder addresses minted for mobile sign-ups never get mail (the reminders cron's rule). */
function mailable(email: string | null | undefined): email is string {
  return typeof email === "string" && email !== "" && !email.endsWith("@users.noemail")
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

function viewStatus(
  status: MentorshipSessionStatus,
  scheduledAt: Date | null,
  meetingStatus: string | undefined,
  now: number
): MentorshipSessionView["status"] {
  if (status !== "confirmed") return status
  if (meetingStatus === "ended") return "past"
  if (meetingStatus === "active" || meetingStatus === "waiting") return "upcoming"
  return scheduledAt && scheduledAt.getTime() + SESSION_GRACE_MS < now ? "past" : "upcoming"
}

/** Sessions → views: names, course titles and meeting states in three bulk reads. */
async function toViews(sessions: SessionLean[]): Promise<MentorshipSessionView[]> {
  if (sessions.length === 0) return []
  const userIds = [...new Set(sessions.flatMap((s) => [s.student.toString(), s.instructor.toString()]))]
  const courseIds = [...new Set(sessions.map((s) => s.course.toString()))]
  const meetingIds = sessions.flatMap((s) => (s.meetingId ? [s.meetingId.toString()] : []))
  const [users, courses, meetings] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("firstName lastName").lean(),
    Course.find({ _id: { $in: courseIds } }).select("title").lean(),
    Meeting.find({ _id: { $in: meetingIds } }).select("status").lean(),
  ])
  const usersById = new Map(users.map((u) => [u._id.toString(), u]))
  const titlesById = new Map(courses.map((c) => [c._id.toString(), c.title]))
  const meetingStatusById = new Map(meetings.map((m) => [m._id.toString(), m.status]))
  const now = Date.now()

  return sessions.map((s) => {
    const meetingId = s.meetingId ? s.meetingId.toString() : null
    const status = viewStatus(s.status, s.scheduledAt, meetingId ? meetingStatusById.get(meetingId) : undefined, now)
    return {
      id: s._id.toString(),
      courseId: s.course.toString(),
      courseTitle: titlesById.get(s.course.toString()) ?? "",
      studentName: fullName(usersById.get(s.student.toString()), "Student"),
      instructorName: fullName(usersById.get(s.instructor.toString()), "Your mentor"),
      status,
      proposedSlots: (s.proposedSlots ?? []).map((slot) => slot.at.toISOString()),
      scheduledAt: s.scheduledAt ? s.scheduledAt.toISOString() : null,
      note: s.note ?? "",
      responseNote: s.responseNote ?? "",
      joinHref: status === "upcoming" && meetingId ? `/dashboard/meetings?join=${meetingId}` : null,
    }
  })
}

/* ═══════════════════ student ═══════════════════ */

export type MentorshipProgram = {
  courseId: string
  courseTitle: string
  instructorName: string
  roadmap: { text: string; updatedAt: string } | null
  /** An unanswered request exists — the form stays closed until it's answered. */
  hasOpenRequest: boolean
}

export type MyMentorship = {
  /** Access-granting Executive enrollments whose package includes mentorship. */
  programs: MentorshipProgram[]
  /** Every session the student ever requested, newest first (history survives a lapsed package). */
  sessions: MentorshipSessionView[]
}

export async function getMyMentorship(): Promise<MyMentorship> {
  const empty: MyMentorship = { programs: [], sessions: [] }
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return empty

    const [enrollments, sessions] = await Promise.all([
      Enrollment.find({ user: user.id, status: { $in: ["active", "completed"] }, packageKey: "executive" })
        .select("course packageKey mentorRoadmap")
        .lean(),
      MentorshipSession.find({ student: user.id }).sort({ createdAt: -1 }).limit(50).lean(),
    ])
    const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.course) } })
      .select("title packages instructor")
      .lean()
    const coursesById = new Map(courses.map((c) => [c._id.toString(), c]))
    const mentored = enrollments.flatMap((enrollment) => {
      const course = coursesById.get(enrollment.course.toString())
      return course && includesMentorship(course, enrollment) ? [{ enrollment, course }] : []
    })
    const instructors = await User.find({ _id: { $in: mentored.map((m) => m.course.instructor) } })
      .select("firstName lastName")
      .lean()
    const instructorsById = new Map(instructors.map((u) => [u._id.toString(), u]))
    const openRequests = new Set(
      sessions.filter((s) => s.status === "requested").map((s) => s.enrollment.toString())
    )

    return {
      programs: mentored.map(({ enrollment, course }) => ({
        courseId: course._id.toString(),
        courseTitle: course.title,
        instructorName: fullName(instructorsById.get(course.instructor.toString()), "Your mentor"),
        roadmap: enrollment.mentorRoadmap
          ? { text: enrollment.mentorRoadmap.text, updatedAt: enrollment.mentorRoadmap.updatedAt.toISOString() }
          : null,
        hasOpenRequest: openRequests.has(enrollment._id.toString()),
      })),
      sessions: await toViews(sessions),
    }
  } catch (error) {
    console.error("Get my mentorship error:", error)
    return empty
  }
}

const RequestInput = z.object({
  courseId: z.string().regex(OBJECT_ID, "Unknown program"),
  slots: z.array(z.string()).min(1, "Propose at least one time").max(3, "Propose up to three times"),
  note: z.string().trim().max(1000, "Keep your note under 1,000 characters").default(""),
})

/** The student proposes 1–3 times for a private session on one Executive program. */
export async function requestMentorshipSession(input: {
  courseId: string
  slots: string[]
  note?: string
}): Promise<{ success: true; data: { sessionId: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = RequestInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }

    const now = Date.now()
    const times = [...new Set(parsed.data.slots.map((slot) => new Date(slot).getTime()))].sort((a, b) => a - b)
    if (times.some((t) => Number.isNaN(t))) return { success: false, error: "Pick valid dates and times" }
    if (times.some((t) => t < now + MIN_LEAD_MS)) {
      return { success: false, error: "Each time must be at least an hour from now" }
    }
    if (times.some((t) => t > now + MAX_AHEAD_MS)) {
      return { success: false, error: "Propose times within the next 60 days" }
    }

    const access = await getCourseAccess(user.id, parsed.data.courseId)
    if (!access || !includesMentorship(access.course, access)) {
      return { success: false, error: "Private mentorship isn't included in your package" }
    }

    let sessionId: string
    try {
      const session = await MentorshipSession.create({
        student: user.id,
        instructor: access.course.instructorId,
        course: access.course.id,
        enrollment: access.enrollmentId,
        status: "requested",
        proposedSlots: times.map((t) => ({ at: new Date(t) })),
        note: parsed.data.note,
      })
      sessionId = session._id.toString()
    } catch (error) {
      if (isDuplicateKey(error)) return { success: false, error: "You already have a request waiting for your mentor" }
      throw error
    }

    const [course, instructor] = await Promise.all([
      Course.findById(access.course.id).select("title").lean(),
      User.findById(access.course.instructorId).select("firstName email").lean(),
    ])
    const courseTitle = course?.title ?? "their program"
    const studentName = fullName(user, user.email)
    const proposed = times.map((t) => formatUtcDateTime(new Date(t))).join("; ")

    void notifyUser(access.course.instructorId, {
      type: "meeting",
      title: "Mentorship session requested",
      body: `${studentName} (${courseTitle}) proposed: ${proposed}.`.slice(0, 500),
      href: INSTRUCTOR_PATH,
    })
    if (mailable(instructor?.email)) {
      void sendMentorshipEmail(instructor.email, {
        subject: "New mentorship session request",
        title: "A student asked for a session",
        bodyText: `${studentName} (${courseTitle}) proposed: ${proposed}. Confirm one from Meetings.`,
        ctaLabel: "Review request",
        ctaUrl: `${APP_URL}${INSTRUCTOR_PATH}`,
        recipientName: instructor.firstName || undefined,
      })
    }

    revalidatePath(STUDENT_PATH)
    return { success: true, data: { sessionId } }
  } catch (error) {
    console.error("Request mentorship session error:", error)
    return { success: false, error: "Couldn't send your request — try again" }
  }
}

const CancelInput = z.object({
  sessionId: z.string().regex(OBJECT_ID, "Session not found"),
  note: z.string().trim().max(500, "Keep the note under 500 characters").default(""),
})

/**
 * Close a session. The course instructor on a request → declined; either party
 * on a request or an unstarted confirmed session → cancelled (its meeting ends,
 * leaving invites and the reminder cron). The other side is told.
 */
export async function cancelMentorshipSession(
  sessionId: string,
  note?: string
): Promise<{ success: true; data: { status: "declined" | "cancelled" } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = CancelInput.safeParse({ sessionId, note: note ?? "" })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }

    const session = await MentorshipSession.findById(parsed.data.sessionId).lean()
    if (!session) return { success: false, error: "Session not found" }
    const isStudent = session.student.toString() === user.id
    const isInstructor = session.instructor.toString() === user.id
    if (!isStudent && !isInstructor) return { success: false, error: "Session not found" }
    if (session.status !== "requested" && session.status !== "confirmed") {
      return { success: false, error: "This session is already closed" }
    }

    if (session.status === "confirmed" && session.meetingId) {
      const meeting = await Meeting.findById(session.meetingId).select("status").lean()
      if (meeting?.status === "ended") return { success: false, error: "This session has already happened" }
      if (meeting && meeting.status !== "scheduled") {
        return { success: false, error: "This session has started — end it from the room" }
      }
    }

    const nextStatus: "declined" | "cancelled" =
      session.status === "requested" && isInstructor ? "declined" : "cancelled"
    const closed = await MentorshipSession.findOneAndUpdate(
      { _id: session._id, status: session.status },
      { $set: { status: nextStatus, responseNote: parsed.data.note, cancelledBy: user.id } },
      { new: true }
    )
    if (!closed) return { success: false, error: "This session just changed — refresh and try again" }

    if (session.meetingId) {
      await Meeting.updateOne(
        { _id: session.meetingId, status: "scheduled" },
        { $set: { status: "ended", endedAt: new Date() } }
      )
    }

    const [counterpart, course] = await Promise.all([
      User.findById(isStudent ? session.instructor : session.student).select("firstName email").lean(),
      Course.findById(session.course).select("title").lean(),
    ])
    const courseTitle = course?.title ?? "the program"
    const actorName = fullName(user, isStudent ? "Your student" : "Your mentor")
    const quoted = parsed.data.note ? ` “${parsed.data.note}”` : ""
    const title = nextStatus === "declined" ? "Mentorship request declined" : "Mentorship session cancelled"
    const body =
      nextStatus === "declined"
        ? `${actorName} can't take the times you proposed for ${courseTitle}.${quoted} You can propose new times.`
        : session.scheduledAt
          ? `${actorName} cancelled the ${formatUtcDateTime(session.scheduledAt)} session for ${courseTitle}.${quoted}`
          : `${actorName} withdrew the session request for ${courseTitle}.${quoted}`
    const href = isStudent ? INSTRUCTOR_PATH : STUDENT_PATH

    void notifyUser((isStudent ? session.instructor : session.student).toString(), {
      type: "meeting",
      title,
      body: body.slice(0, 500),
      href,
    })
    if (mailable(counterpart?.email)) {
      void sendMentorshipEmail(counterpart.email, {
        subject: title,
        title,
        bodyText: body,
        ctaLabel: isStudent ? "Open meetings" : "Open mentorship",
        ctaUrl: `${APP_URL}${href}`,
        recipientName: counterpart.firstName || undefined,
      })
    }

    revalidatePath(STUDENT_PATH)
    revalidatePath(INSTRUCTOR_PATH)
    return { success: true, data: { status: nextStatus } }
  } catch (error) {
    console.error("Cancel mentorship session error:", error)
    return { success: false, error: "Couldn't update the session — try again" }
  }
}
