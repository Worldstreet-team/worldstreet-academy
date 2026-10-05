import "server-only"

import mongoose, { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Course, Enrollment, PointEvent, User, type PointEventKind } from "@/lib/db/models"
import { maskedName } from "@/lib/masked-name"

/**
 * Learning points (owner meeting, 2026-10-03: "as he's doing his assignments,
 * completing his course, he's earning some points"). No cash value. This is
 * the one home for what each event is worth and how each award is keyed —
 * import it, never re-derive an amount at a call site. Every award is one
 * `pointevents` row whose unique `key` makes it pay once; totals are summed on
 * read, never cached.
 */

/** What each event is worth. A graded assignment is worth `gradePoints(grade)` on top of its submission. */
export const POINTS = {
  lesson_completed: 10,
  assignment_submitted: 20,
  exam_passed: 50,
  course_completed: 200,
} as const

/** A graded assignment: the grade (0–100) ÷ 5, rounded — up to 20 points. */
export function gradePoints(grade: number): number {
  return Math.round(Math.min(100, Math.max(0, grade)) / 5)
}

/** One key per thing that earns points, so each pays once however often it is saved. */
export const pointKey = {
  lesson: (enrollmentId: string, lessonId: string) => `lesson:${enrollmentId}:${lessonId}`,
  assignmentSubmitted: (submissionId: string) => `assignment-submitted:${submissionId}`,
  assignmentGraded: (submissionId: string) => `assignment-graded:${submissionId}`,
  examPassed: (enrollmentId: string, examId: string) => `exam:${enrollmentId}:${examId}`,
  courseCompleted: (enrollmentId: string) => `course:${enrollmentId}`,
}

/** How the activity list names each kind. */
export const POINT_KIND_LABEL: Record<PointEventKind, string> = {
  lesson_completed: "Lesson completed",
  assignment_submitted: "Assignment submitted",
  assignment_graded: "Assignment graded",
  exam_passed: "Final exam passed",
  course_completed: "Program completed",
}

type Id = string | Types.ObjectId

export type PointAward = {
  userId: Id
  courseId: Id | null
  kind: PointEventKind
  points: number
  key: string
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 11000
}

async function writeAward({ userId, courseId, kind, points, key }: PointAward): Promise<void> {
  const amount = Math.round(points)
  if (!Number.isFinite(amount) || amount <= 0) return
  await connectDB()
  await PointEvent.create({ user: userId, course: courseId ?? null, kind, points: amount, key })
}

/**
 * Record one award. Never rejects: an award already written (duplicate key)
 * is a no-op, and any other failure is logged and dropped — points never fail
 * the action that earned them. Call it fire-and-forget (`void awardPoints(…)`)
 * after the action's own write.
 */
export function awardPoints(award: PointAward): Promise<void> {
  return writeAward(award).catch((error: unknown) => {
    if (isDuplicateKey(error)) return
    console.error(`[Points] couldn't award ${award.key}`, error)
  })
}

/* ── Reads ───────────────────────────────────────────────────────────────
   Callers have already run connectDB() and resolved the signed-in user. */

const WEEK_MS = 7 * 24 * 3600 * 1000
const ACCESS_GRANTING = ["active", "completed"]

export type PointsSummary = { total: number; thisWeek: number }

/** The student's total and what the last seven days added. */
export async function pointsSummary(userId: string): Promise<PointsSummary> {
  if (!mongoose.isValidObjectId(userId)) return { total: 0, thisWeek: 0 }
  const since = new Date(Date.now() - WEEK_MS)
  const [row] = await PointEvent.aggregate<PointsSummary>([
    { $match: { user: new Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        total: { $sum: "$points" },
        thisWeek: { $sum: { $cond: [{ $gte: ["$createdAt", since] }, "$points", 0] } },
      },
    },
  ])
  return { total: row?.total ?? 0, thisWeek: row?.thisWeek ?? 0 }
}

export type PointActivity = {
  id: string
  kind: PointEventKind
  label: string
  points: number
  courseTitle: string | null
  at: string
}

/** The student's latest awards, newest first. */
export async function recentPointActivity(userId: string, limit = 20): Promise<PointActivity[]> {
  if (!mongoose.isValidObjectId(userId)) return []
  const rows = await PointEvent.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("kind points course createdAt")
    .lean()
  const courseIds = [...new Set(rows.flatMap((r) => (r.course ? [r.course.toString()] : [])))]
  const courses = courseIds.length
    ? await Course.find({ _id: { $in: courseIds } }).select("title").lean()
    : []
  const titles = new Map(courses.map((c) => [c._id.toString(), c.title]))
  return rows.map((r) => ({
    id: r._id.toString(),
    kind: r.kind,
    label: POINT_KIND_LABEL[r.kind] ?? "Points",
    points: r.points,
    courseTitle: r.course ? (titles.get(r.course.toString()) ?? null) : null,
    at: new Date(r.createdAt).toISOString(),
  }))
}

export const LEADERBOARD_SIZE = 10

export type LeaderboardRow = { rank: number; name: string; points: number; isMe: boolean }

export type ProgramLeaderboard = {
  courseId: string
  courseTitle: string
  /** Learners on the board: enrolled (active or completed) with at least one point. */
  ranked: number
  top: LeaderboardRow[]
  /** The student's own row when they are ranked outside the top ten; null otherwise. */
  me: LeaderboardRow | null
  myPoints: number
}

/**
 * One board per program the student is enrolled in (active or completed).
 * Only learners currently enrolled are ranked — a refunded learner's points
 * stay in their history but leave the board. Names are first name + last
 * initial. Equal points share a rank ("1, 2, 2, 4").
 */
export async function programLeaderboards(userId: string): Promise<ProgramLeaderboard[]> {
  if (!mongoose.isValidObjectId(userId)) return []
  const enrollments = await Enrollment.find({ user: userId, status: { $in: ACCESS_GRANTING } })
    .sort({ lastAccessedAt: -1 })
    .select("course")
    .lean()
  const courseIds = [...new Set(enrollments.map((e) => e.course.toString()))]
  if (courseIds.length === 0) return []
  const courses = await Course.find({ _id: { $in: courseIds } }).select("title").lean()
  const titles = new Map(courses.map((c) => [c._id.toString(), c.title]))
  return Promise.all(
    courseIds.filter((id) => titles.has(id)).map((id) => leaderboardFor(id, titles.get(id) ?? "", userId))
  )
}

async function leaderboardFor(courseId: string, courseTitle: string, userId: string): Promise<ProgramLeaderboard> {
  const course = new Types.ObjectId(courseId)
  const [totals, enrolled] = await Promise.all([
    PointEvent.aggregate<{ _id: Types.ObjectId; points: number }>([
      { $match: { course } },
      { $group: { _id: "$user", points: { $sum: "$points" } } },
    ]),
    Enrollment.distinct("user", { course, status: { $in: ACCESS_GRANTING } }),
  ])
  const enrolledIds = new Set(enrolled.map((id) => String(id)))

  const sorted = totals
    .map((t) => ({ userId: t._id.toString(), points: t.points }))
    .filter((t) => t.points > 0 && enrolledIds.has(t.userId))
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId))
  let rank = 0
  let previous: number | null = null
  const ranked = sorted.map((row, i) => {
    if (row.points !== previous) {
      rank = i + 1
      previous = row.points
    }
    return { ...row, rank }
  })

  const top = ranked.slice(0, LEADERBOARD_SIZE)
  const mine = ranked.find((r) => r.userId === userId) ?? null
  const outside = mine && !top.some((r) => r.userId === userId) ? mine : null
  const named = [...top, ...(outside ? [outside] : [])]
  const users = named.length
    ? await User.find({ _id: { $in: named.map((r) => r.userId) } }).select("firstName lastName").lean()
    : []
  const names = new Map(users.map((u) => [u._id.toString(), maskedName(u.firstName, u.lastName)]))
  const toRow = (r: (typeof ranked)[number]): LeaderboardRow => ({
    rank: r.rank,
    name: names.get(r.userId) ?? maskedName(null, null),
    points: r.points,
    isMe: r.userId === userId,
  })

  return {
    courseId,
    courseTitle,
    ranked: ranked.length,
    top: top.map(toRow),
    me: outside ? toRow(outside) : null,
    myPoints: mine?.points ?? 0,
  }
}
