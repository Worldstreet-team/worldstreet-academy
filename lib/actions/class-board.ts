"use server"

import { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Course, Enrollment, Meeting, Recording, User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { entitlementsFor } from "@/lib/entitlements"
import { courseKindOf } from "@/lib/course-kind"
import { COHORT_STARTS_AT_ISO, cohortIsUpcoming } from "@/lib/cohort"

/**
 * The student dashboard's live-class board (owner meeting 2026-10-03; Owen,
 * 2026-10-06): for every program the learner can attend live classes in —
 * the class that is live right now, the next scheduled one, the latest
 * recording, and, for a school program with nothing scheduled yet, the cohort
 * start to count down to. One batched read; the dashboard polls it.
 *
 * Audience rules are getUpcomingClasses'(lib/actions/meetings.ts): an active
 * or completed enrollment whose package includes live classes. Mentorship
 * rooms are never listed. A scheduled class stays "next" for two hours past
 * its start while the host is late, as on the meetings page.
 */

/** A class the host hasn't started stays listed this long past its start time. */
const LATE_HOST_GRACE_MS = 2 * 3600 * 1000

export type BoardClass = {
  id: string
  title: string
  /** ISO start (scheduled) — for a live class, when it was scheduled, else when it went live. */
  startsAt: string
  hostName: string
  joinHref: string
}

export type BoardRecording = { id: string; title: string; recordedAt: string; href: string }

export type ClassBoardEntry = {
  courseId: string
  courseTitle: string
  /** The class running now, if any. */
  live: BoardClass | null
  /** The next scheduled class (may be up to 2 h late if the host hasn't started it). */
  next: BoardClass | null
  latestRecording: BoardRecording | null
  /** ISO cohort start, only for a school program with no class scheduled while the cohort is still ahead. */
  cohortStartsAt: string | null
}

const joinHref = (meetingId: string) => `/dashboard/meetings?join=${meetingId}`

function fullName(u: { firstName?: string | null; lastName?: string | null } | undefined): string {
  return u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : ""
}

export async function getMyClassBoard(): Promise<ClassBoardEntry[]> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return []

    const enrollments = await Enrollment.find({
      user: new Types.ObjectId(user.id),
      status: { $in: ["active", "completed"] },
    })
      .select("course packageKey")
      .lean()
    if (enrollments.length === 0) return []

    const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.course) } })
      .select("title packages format kind")
      .lean()
    const courseById = new Map(courses.map((c) => [c._id.toString(), c]))
    const entitled = enrollments.filter((e) => {
      const course = courseById.get(e.course.toString())
      return course ? entitlementsFor(course, e).liveClasses : false
    })
    if (entitled.length === 0) return []
    const courseIds = entitled.map((e) => e.course)

    const [liveRooms, scheduled, recordings] = await Promise.all([
      Meeting.find({
        courseId: { $in: courseIds },
        status: "active",
        mentorshipSessionId: null,
      })
        .sort({ updatedAt: -1 })
        .select("title courseId scheduledAt hostId createdAt")
        .lean(),
      Meeting.find({
        courseId: { $in: courseIds },
        status: "scheduled",
        mentorshipSessionId: null,
        scheduledAt: { $gte: new Date(Date.now() - LATE_HOST_GRACE_MS) },
      })
        .sort({ scheduledAt: 1 })
        .limit(100)
        .select("title courseId scheduledAt hostId")
        .lean(),
      Recording.find({ course: { $in: courseIds }, status: "stored", hidden: { $ne: true } })
        .sort({ recordedAt: -1 })
        .limit(100)
        .select("title course recordedAt")
        .lean(),
    ])

    const hostIds = [...new Set([...liveRooms, ...scheduled].map((m) => m.hostId?.toString()).filter(Boolean))]
    const hosts = await User.find({ _id: { $in: hostIds } }).select("firstName lastName").lean()
    const hostName = new Map(hosts.map((h) => [h._id.toString(), fullName(h)]))

    // First match per course wins: the lists are already sorted.
    const firstBy = <T extends { courseId?: Types.ObjectId | null }>(rows: T[]) => {
      const out = new Map<string, T>()
      for (const r of rows) {
        const key = r.courseId?.toString()
        if (key && !out.has(key)) out.set(key, r)
      }
      return out
    }
    const liveBy = firstBy(liveRooms)
    const nextBy = firstBy(scheduled)
    const recordingBy = new Map<string, (typeof recordings)[number]>()
    for (const r of recordings) {
      const key = r.course.toString()
      if (!recordingBy.has(key)) recordingBy.set(key, r)
    }

    const cohortAhead = cohortIsUpcoming()
    return entitled.map((e) => {
      const id = e.course.toString()
      const course = courseById.get(id)
      const live = liveBy.get(id)
      const next = nextBy.get(id)
      const rec = recordingBy.get(id)
      const asClass = (m: NonNullable<typeof live>, startsAt: Date): BoardClass => ({
        id: m._id.toString(),
        title: m.title,
        startsAt: startsAt.toISOString(),
        hostName: hostName.get(m.hostId?.toString() ?? "") ?? "",
        joinHref: joinHref(m._id.toString()),
      })
      return {
        courseId: id,
        courseTitle: course?.title ?? "",
        live: live ? asClass(live, live.scheduledAt ?? live.createdAt) : null,
        next: next && next.scheduledAt ? asClass(next, next.scheduledAt) : null,
        latestRecording: rec
          ? { id: rec._id.toString(), title: rec.title, recordedAt: rec.recordedAt.toISOString(), href: "/dashboard/recordings" }
          : null,
        cohortStartsAt:
          !next && !live && cohortAhead && course && courseKindOf(course) === "program" ? COHORT_STARTS_AT_ISO : null,
      }
    })
  } catch (error) {
    console.error("[ClassBoard] read failed:", error)
    return []
  }
}
