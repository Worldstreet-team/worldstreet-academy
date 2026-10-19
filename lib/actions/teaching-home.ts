"use server"

import { Types } from "mongoose"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import {
  Assignment,
  Course,
  Earning,
  Enrollment,
  Meeting,
  MentorshipSession,
  Recording,
  Submission,
  User,
  type CourseKind,
  type CourseStatus,
  type RecordingStatus,
} from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { entitlementsFor } from "@/lib/entitlements"
import { COURSE_KIND_LABEL, courseKindOf } from "@/lib/course-kind"
import { cohortsForEnrollments, getCohortCalendar } from "@/lib/cohort-calendar"
import type { CohortView } from "@/lib/cohort-rules"
import { safeWebUrl } from "@/lib/faculty"
import { referralSummary } from "@/lib/referrals"
import { SCHOOL_BY_SLUG, isSchoolSlug } from "@/lib/schools"

/*
 * The tutor home (/instructor) in one read: the class to start next (or the
 * one that is live), the week's classes and confirmed mentorship sessions,
 * one cohort card per course they teach, what is waiting on them, and their
 * money. Faculty only — an approved marketplace seller is a USER who owns
 * courses too, and their home is /instructor/courses.
 *
 * Every collection is read once, batched with $in or grouped in an
 * aggregate, never per course. Times leave as ISO; the browser lays them out
 * in its own zone, which is why it sends where its day and month begin.
 * Read-only: starting a class still goes through joinMeeting and its
 * early-start rule (lib/class-schedule.ts).
 */

const HOST_MEETINGS_PATH = "/instructor/meetings"
const DAY_MS = 24 * 3600_000
/** A class the host hasn't started stays "next" this long past its start — getUpcomingClasses' grace for a late host. */
const LATE_HOST_GRACE_MS = 2 * 3600_000
/** Failed recordings older than this are past RealtimeKit's 7-day copy window and the retries; the home stops nagging. */
const RECORDING_CHECK_WINDOW_MS = 14 * DAY_MS
const WEEK_ENTRY_LIMIT = 200
const RECORDING_TODO_LIMIT = 5

/** A class or a confirmed mentorship session on the week strip. */
export type HomeEntry = {
  /** The Meeting _id. */
  id: string
  kind: "class" | "mentorship"
  title: string
  courseTitle: string
  /** Mentorship only. */
  studentName: string | null
  /** ISO — the scheduled time, or the start of a class opened on the spot. */
  start: string
  state: "upcoming" | "live" | "ended"
  /** The host's start/rejoin link (joinMeeting still enforces the early-start rule). */
  joinHref: string
}

/** The class the hero is about: the live one, else the next scheduled one. */
export type HeroClass = {
  id: string
  title: string
  courseId: string
  courseTitle: string
  /** The course's own thumbnail (instructor surfaces show what was uploaded). */
  art: string | null
  /** ISO scheduled start (the start of a class opened on the spot). */
  start: string
  /** ISO, once live. */
  startedAt: string | null
  live: boolean
  joinHref: string
  /** Students whose active/completed enrollment includes live classes — the class email's audience. */
  studentsExpected: number
}

export type CohortCard = {
  id: string
  title: string
  kind: CourseKind
  kindLabel: string
  schoolName: string | null
  status: CourseStatus
  art: string | null
  /** Course.enrolledCount, as the course list shows it. */
  enrolled: number
  nextClass: { id: string; title: string; start: string; live: boolean } | null
  toGrade: number
  gradeHref: string
  mentorshipRequests: number
  latestRecording: { status: RecordingStatus; recordedAt: string } | null
  communityUrl: string | null
  /** Program courses only: learners per cohort (D20), ascending by cohort number, zeros left out. */
  cohortCounts: { name: string; count: number }[]
  manageHref: string
}

export type TodoItem = {
  key: string
  kind: "grade" | "mentorship" | "recording"
  count: number
  title: string
  detail: string
  href: string
  /** ISO — how long the oldest item has waited. */
  since: string
}

export type TeachingMoney = {
  /** Net of every row still in the clearing window (sales, referrals, adjustments). */
  pendingMinor: number
  /** Net of every row credited to the wallet. */
  clearedMinor: number
  /** Sale rows created since the start of the browser's month, refunds excluded. */
  salesThisMonth: number
  /** Referral commissions, pending + cleared (lib/referrals.ts); null when that read failed. */
  referralMinor: number | null
}

export type TeachingHome = {
  hero: HeroClass | null
  week: HomeEntry[]
  /** School programs first, then marketplace, then New Economy. */
  cohorts: CohortCard[]
  draftCount: number
  /** Teaches a school program that is out of draft (the cohort start applies). */
  teachesProgram: boolean
  /** The next cohort that has not begun (D20); null when none is scheduled. */
  nextCohort: CohortView | null
  /** Grade, then mentorship, then recordings; oldest first within each. Unread messages are added by the page from the shell's count. */
  todo: TodoItem[]
  money: TeachingMoney
}

const inputSchema = z.object({
  /** Local midnight today, from the browser. */
  weekStart: z.iso.datetime(),
  /** Local midnight on the 1st of this month, from the browser. */
  monthStart: z.iso.datetime(),
})

type MeetingRow = {
  _id: Types.ObjectId
  title: string
  courseId?: Types.ObjectId | null
  mentorshipSessionId?: Types.ObjectId | null
  status: "scheduled" | "waiting" | "active" | "ended"
  scheduledAt?: Date | null
  startedAt?: Date | null
}

const KIND_ORDER: Record<CourseKind, number> = { program: 0, marketplace: 1, "new-economy": 2 }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The browser's instant when it is plausible, else the UTC fallback — a bad clock only shifts the window. */
function clampInstant(iso: string, min: number, max: number, fallback: Date): Date {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= min && t <= max ? new Date(t) : fallback
}

function isLive(status: MeetingRow["status"]): boolean {
  return status === "active" || status === "waiting"
}

export async function getTeachingHome(input: {
  weekStart: string
  monthStart: string
}): Promise<{ success: true; data: TeachingHome } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    // Faculty only: an approved seller is a USER and gets /instructor/courses instead.
    if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") return { success: false, error: "Instructors only" }
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid dates" }

    const now = Date.now()
    const utcToday = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()))
    const utcMonth = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1))
    const weekStart = clampInstant(parsed.data.weekStart, now - 1.5 * DAY_MS, now + 0.6 * DAY_MS, utcToday)
    const monthStart = clampInstant(parsed.data.monthStart, now - 32 * DAY_MS, now + 0.6 * DAY_MS, utcMonth)
    // Seven local days, plus slack for a DST change; the browser drops anything past its 7th day.
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS + 2 * 3600_000)
    const windowFrom = new Date(Math.min(weekStart.getTime(), now - LATE_HOST_GRACE_MS))
    const lateCutoff = new Date(now - LATE_HOST_GRACE_MS)

    // Every read is scoped to the caller — by hostId or instructor, never by an id from the browser.
    const me = new Types.ObjectId(user.id)

    const [courses, meetings, nextByCourse, requestsByCourse, earningGroups, referrals] = await Promise.all([
      Course.find({ instructor: me })
        .select("title slug school kind status thumbnailUrl enrolledCount communityUrl packages")
        .lean(),
      // The week's classes and sessions, plus anything live right now.
      Meeting.find({
        hostId: me,
        $and: [
          { $or: [{ courseId: { $ne: null } }, { mentorshipSessionId: { $ne: null } }] },
          { $or: [{ status: { $in: ["active", "waiting"] } }, { scheduledAt: { $gte: windowFrom, $lt: weekEnd } }] },
        ],
      })
        .select("title courseId mentorshipSessionId status scheduledAt startedAt")
        .sort({ scheduledAt: 1 })
        .limit(WEEK_ENTRY_LIMIT)
        .lean<MeetingRow[]>(),
      // Each course's next class, however far ahead.
      Meeting.aggregate<{ _id: Types.ObjectId; meetingId: Types.ObjectId; title: string; scheduledAt: Date }>([
        {
          $match: {
            hostId: me,
            courseId: { $ne: null },
            mentorshipSessionId: null,
            status: "scheduled",
            scheduledAt: { $gte: lateCutoff },
          },
        },
        { $sort: { scheduledAt: 1 } },
        {
          $group: {
            _id: "$courseId",
            meetingId: { $first: "$_id" },
            title: { $first: "$title" },
            scheduledAt: { $first: "$scheduledAt" },
          },
        },
      ]),
      // Unanswered mentorship requests — getMentorshipQueue's "requests".
      MentorshipSession.aggregate<{ _id: Types.ObjectId; count: number; oldest: Date }>([
        { $match: { instructor: me, status: "requested" } },
        { $group: { _id: "$course", count: { $sum: 1 }, oldest: { $min: "$createdAt" } } },
      ]),
      // The ledger getMyInstructorEarnings totals, grouped once.
      Earning.aggregate<{ _id: string; netMinor: number; monthSales: number }>([
        { $match: { instructor: me } },
        {
          $group: {
            _id: "$status",
            netMinor: { $sum: "$netMinor" },
            monthSales: {
              $sum: { $cond: [{ $and: [{ $eq: ["$kind", "sale"] }, { $gte: ["$createdAt", monthStart] }] }, 1, 0] },
            },
          },
        },
      ]),
      referralSummary(user.id, 0).catch((error: unknown) => {
        console.error("[TeachingHome] referral summary failed:", error)
        return null
      }),
    ])

    const courseById = new Map(courses.map((c) => [c._id.toString(), c]))
    const taught = courses.filter((c) => c.status !== "draft" && c.status !== "archived")
    const taughtIds = taught.map((c) => c._id)

    const liveClasses = meetings
      .filter((m) => m.courseId && !m.mentorshipSessionId && isLive(m.status))
      .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))
    const liveByCourse = new Map<string, MeetingRow>()
    for (const m of liveClasses) {
      const key = m.courseId?.toString()
      if (key && !liveByCourse.has(key)) liveByCourse.set(key, m)
    }
    const nextClassByCourse = new Map(nextByCourse.map((n) => [n._id.toString(), n]))

    // The hero: a live class beats the next scheduled one.
    const soonest = [...nextByCourse].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0]
    const heroLive = liveClasses[0]
    const heroCourseId = heroLive?.courseId?.toString() ?? soonest?._id.toString() ?? null
    const heroCourse = heroCourseId ? courseById.get(heroCourseId) : undefined

    const sessionMeetings = meetings.filter((m) => m.mentorshipSessionId)
    const failedSince = new Date(now - RECORDING_CHECK_WINDOW_MS)

    const [heroEnrollments, sessions, toGradeByCourse, recordingFacets] = await Promise.all([
      heroCourse
        ? Enrollment.find({ course: heroCourse._id, status: { $in: ["active", "completed"] } })
            .select("user packageKey")
            .lean()
        : Promise.resolve([]),
      sessionMeetings.length
        ? MentorshipSession.find({ _id: { $in: sessionMeetings.flatMap((m) => (m.mentorshipSessionId ? [m.mentorshipSessionId] : [])) } })
            .select("status student course")
            .lean()
        : Promise.resolve([]),
      // Submissions awaiting a grade, through the course's assignments (Submission is indexed by assignment).
      taughtIds.length
        ? Assignment.find({ course: { $in: taughtIds } })
            .select("_id")
            .lean()
            .then((rows) =>
              rows.length
                ? Submission.aggregate<{ _id: Types.ObjectId; count: number; oldest: Date }>([
                    { $match: { assignment: { $in: rows.map((r) => r._id) }, status: "submitted" } },
                    { $group: { _id: "$course", count: { $sum: 1 }, oldest: { $min: "$submittedAt" } } },
                  ])
                : []
            )
        : Promise.resolve([]),
      taughtIds.length
        ? Recording.aggregate<{
            latest: { _id: Types.ObjectId; status: RecordingStatus; recordedAt: Date }[]
            failed: { _id: Types.ObjectId; title: string; course: Types.ObjectId; recordedAt: Date }[]
          }>([
            { $match: { course: { $in: taughtIds } } },
            { $sort: { recordedAt: -1 } },
            {
              $facet: {
                latest: [{ $group: { _id: "$course", status: { $first: "$status" }, recordedAt: { $first: "$recordedAt" } } }],
                // One row per class whose recording failed (a class can have several parts).
                failed: [
                  { $match: { status: "failed", recordedAt: { $gte: failedSince } } },
                  {
                    $group: {
                      _id: "$meeting",
                      title: { $first: "$title" },
                      course: { $first: "$course" },
                      recordedAt: { $first: "$recordedAt" },
                    },
                  },
                  { $sort: { recordedAt: 1 } },
                  { $limit: RECORDING_TODO_LIMIT },
                ],
              },
            },
          ])
        : Promise.resolve([]),
    ])

    const confirmedSessions = sessions.filter((s) => s.status === "confirmed")
    const students = confirmedSessions.length
      ? await User.find({ _id: { $in: confirmedSessions.map((s) => s.student) } })
          .select("firstName lastName")
          .lean()
      : []
    const studentName = new Map(
      students.map((u) => [u._id.toString(), `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Student"])
    )
    const sessionById = new Map(confirmedSessions.map((s) => [s._id.toString(), s]))

    /* ── Hero ── */
    const heroSource = heroLive
      ? {
          id: heroLive._id.toString(),
          title: heroLive.title,
          start: heroLive.scheduledAt ?? heroLive.startedAt ?? new Date(now),
          startedAt: heroLive.startedAt ?? null,
        }
      : soonest
        ? { id: soonest.meetingId.toString(), title: soonest.title, start: soonest.scheduledAt, startedAt: null }
        : null
    let hero: HeroClass | null = null
    if (heroCourse && heroSource) {
      const studentsExpected = new Set(
        heroEnrollments
          .filter((e) => entitlementsFor(heroCourse, e).liveClasses)
          .map((e) => e.user.toString())
          .filter((id) => id !== user.id)
      ).size
      hero = {
        id: heroSource.id,
        title: heroSource.title,
        courseId: heroCourse._id.toString(),
        courseTitle: heroCourse.title,
        art: heroCourse.thumbnailUrl || null,
        start: heroSource.start.toISOString(),
        startedAt: heroSource.startedAt?.toISOString() ?? null,
        live: Boolean(heroLive),
        joinHref: `${HOST_MEETINGS_PATH}?join=${heroSource.id}`,
        studentsExpected,
      }
    }

    /* ── Week ── */
    const week: HomeEntry[] = []
    for (const m of meetings) {
      const live = isLive(m.status)
      // A cancelled class (ended without starting) leaves the strip.
      if (m.status === "ended" && !m.startedAt) continue
      const start = m.scheduledAt ?? m.startedAt
      if (!start) continue
      const state: HomeEntry["state"] = live ? "live" : m.status === "scheduled" ? "upcoming" : "ended"
      const id = m._id.toString()
      if (m.mentorshipSessionId) {
        const session = sessionById.get(m.mentorshipSessionId.toString())
        if (!session) continue
        week.push({
          id,
          kind: "mentorship",
          title: "Mentorship session",
          courseTitle: courseById.get(session.course.toString())?.title ?? "",
          studentName: studentName.get(session.student.toString()) ?? "Student",
          start: start.toISOString(),
          state,
          joinHref: `${HOST_MEETINGS_PATH}?join=${id}`,
        })
        continue
      }
      week.push({
        id,
        kind: "class",
        title: m.title,
        courseTitle: (m.courseId && courseById.get(m.courseId.toString())?.title) || "",
        studentName: null,
        start: start.toISOString(),
        state,
        joinHref: `${HOST_MEETINGS_PATH}?join=${id}`,
      })
    }
    week.sort((a, b) => a.start.localeCompare(b.start))

    /* ── Cohorts ── */
    const calendar = await getCohortCalendar()
    const programIds = taught.filter((c) => courseKindOf(c) === "program").map((c) => c._id)
    const placed = programIds.length
      ? await Enrollment.find({ course: { $in: programIds }, status: { $in: ["active", "completed"] } })
          .select("_id course purchasedAt createdAt")
          .lean()
      : []
    const cohortOf = await cohortsForEnrollments(placed)
    const countsByCourse = new Map<string, Map<number, { name: string; count: number }>>()
    for (const row of placed) {
      const cohort = cohortOf.get(String(row._id))
      if (!cohort) continue
      const key = row.course.toString()
      const perCohort = countsByCourse.get(key) ?? new Map<number, { name: string; count: number }>()
      const tally = perCohort.get(cohort.number) ?? { name: cohort.name, count: 0 }
      tally.count += 1
      perCohort.set(cohort.number, tally)
      countsByCourse.set(key, perCohort)
    }
    const facets = recordingFacets[0] ?? { latest: [], failed: [] }
    const latestRecording = new Map(facets.latest.map((r) => [r._id.toString(), r]))
    const toGrade = new Map(toGradeByCourse.map((g) => [g._id.toString(), g]))
    const requests = new Map(requestsByCourse.map((r) => [r._id.toString(), r]))

    const cohorts: CohortCard[] = taught
      .map((c) => {
        const id = c._id.toString()
        const kind = courseKindOf(c)
        const live = liveByCourse.get(id)
        const next = nextClassByCourse.get(id)
        const recording = latestRecording.get(id)
        return {
          id,
          title: c.title,
          kind,
          kindLabel: COURSE_KIND_LABEL[kind],
          schoolName: isSchoolSlug(c.school) ? SCHOOL_BY_SLUG[c.school].short : null,
          status: c.status,
          art: c.thumbnailUrl || null,
          enrolled: c.enrolledCount || 0,
          nextClass: live
            ? {
                id: live._id.toString(),
                title: live.title,
                start: (live.startedAt ?? live.scheduledAt ?? new Date(now)).toISOString(),
                live: true,
              }
            : next
              ? { id: next.meetingId.toString(), title: next.title, start: next.scheduledAt.toISOString(), live: false }
              : null,
          toGrade: toGrade.get(id)?.count ?? 0,
          gradeHref: `/instructor/courses/${id}/assignments`,
          mentorshipRequests: requests.get(id)?.count ?? 0,
          latestRecording: recording ? { status: recording.status, recordedAt: recording.recordedAt.toISOString() } : null,
          communityUrl: safeWebUrl(c.communityUrl),
          cohortCounts: [...(countsByCourse.get(id) ?? [])].sort(([a], [b]) => a - b).map(([, tally]) => tally),
          manageHref: `/instructor/courses/${id}`,
        }
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
        const at = a.nextClass ? new Date(a.nextClass.start).getTime() : Infinity
        const bt = b.nextClass ? new Date(b.nextClass.start).getTime() : Infinity
        if (at !== bt) return at - bt
        return a.title.localeCompare(b.title)
      })

    /* ── To do ── */
    const titleOf = (courseId: Types.ObjectId) => courseById.get(courseId.toString())?.title ?? "Course"
    const todo: TodoItem[] = [
      ...[...toGradeByCourse]
        .sort((a, b) => a.oldest.getTime() - b.oldest.getTime())
        .map((g) => ({
          key: `grade-${g._id.toString()}`,
          kind: "grade" as const,
          count: g.count,
          title: `Grade ${plural(g.count, "submission")}`,
          detail: titleOf(g._id),
          href: `/instructor/courses/${g._id.toString()}/assignments`,
          since: g.oldest.toISOString(),
        })),
      ...[...requestsByCourse]
        .sort((a, b) => a.oldest.getTime() - b.oldest.getTime())
        .map((r) => ({
          key: `mentorship-${r._id.toString()}`,
          kind: "mentorship" as const,
          count: r.count,
          title: `Confirm ${plural(r.count, "mentorship request")}`,
          detail: titleOf(r._id),
          href: `${HOST_MEETINGS_PATH}#mentorship`,
          since: r.oldest.toISOString(),
        })),
      ...facets.failed.map((f) => ({
        key: `recording-${f._id.toString()}`,
        kind: "recording" as const,
        count: 1,
        title: `Check the recording of “${f.title}”`,
        detail: titleOf(f.course),
        href: "/instructor/calendar#recordings",
        since: f.recordedAt.toISOString(),
      })),
    ]

    /* ── Money ── */
    let pendingMinor = 0
    let clearedMinor = 0
    let salesThisMonth = 0
    for (const g of earningGroups) {
      if (g._id === "pending") pendingMinor += g.netMinor
      if (g._id === "cleared") clearedMinor += g.netMinor
      if (g._id !== "reversed") salesThisMonth += g.monthSales
    }

    return {
      success: true,
      data: {
        hero,
        week,
        cohorts,
        draftCount: courses.filter((c) => c.status === "draft").length,
        teachesProgram: taught.some((c) => courseKindOf(c) === "program"),
        nextCohort: calendar.next,
        todo,
        money: {
          pendingMinor,
          clearedMinor,
          salesThisMonth,
          referralMinor: referrals ? referrals.pendingMinor + referrals.clearedMinor : null,
        },
      },
    }
  } catch (error) {
    console.error("[TeachingHome] load failed:", error)
    return { success: false, error: "Couldn't load your teaching home" }
  }
}
