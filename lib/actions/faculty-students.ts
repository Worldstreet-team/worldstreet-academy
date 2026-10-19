"use server"

import type { Types } from "mongoose"
import connectDB from "@/lib/db"
import {
  Assignment,
  Course,
  Enrollment,
  Exam,
  ExamAttempt,
  Lesson,
  Meeting,
  Submission,
  User,
  type AttemptStatus,
  type EnrollmentStatus,
} from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import {
  planOf,
  parseStudentFilters,
  performanceOverview,
  type AttentionReason,
  type FacultyStudentFilters,
  type PerformanceRow,
  type PlanFilter,
  type ProgramSummary,
} from "@/lib/faculty-students"
import { isoOrNull } from "@/lib/faculty-format"
import { isFileFormat } from "@/lib/course-format"
import { canAccessLesson, includesMentorship } from "@/lib/entitlements"
import { cohortsFor, masteryFor, type CohortTag, type MasteryResult, type SeamEnrollment } from "@/lib/faculty-seams"

/*
 * My Students: every active or completed learner in the programs the caller
 * teaches (an admin: in every program). Ownership is decided here from the
 * signed-in user, never from an argument. No email leaves this loader; faculty
 * reach learners through Messages.
 */

const MAX_ROWS = 500

export type FacultyStudentRow = {
  enrollmentId: string
  learner: { name: string; avatarUrl: string | null }
  program: { id: string; title: string }
  plan: { key: PlanFilter; label: string }
  status: "active" | "completed"
  cohort: CohortTag | null
  progress: number
  /** When the enrolment became active (activation, else purchase, else creation); null if none is a valid date. */
  enrolledAt: string | null
  lastActiveAt: string | null
  bestExam: { percent: number; passed: boolean } | null
  assignments: { graded: number; average: number | null }
  attendance: number | null
  mastery: number | null
}

export type FacultyStudentsView = {
  scope: "own" | "all"
  programs: { id: string; title: string }[]
  cohorts: CohortTag[]
  masteryReady: boolean
  rows: FacultyStudentRow[]
  total: number
  truncated: boolean
}

type LeanEnrollment = SeamEnrollment & { lastAccessedAt?: Date | null }

type CourseFacts = { title: string; fileProduct: boolean }

/** The caller's scoped, filtered enrolments and what every faculty view reads about them. */
type Scoped = {
  admin: boolean
  /** Every active or completed enrolment in scope, before the filters. */
  all: LeanEnrollment[]
  /** After the program, plan and cohort filters; not yet sorted or capped. */
  filtered: LeanEnrollment[]
  courseOf: Map<string, CourseFacts>
  cohortMap: Map<string, CohortTag>
  cohorts: CohortTag[]
}

/** A missing or invalid date sorts last instead of throwing or returning NaN. */
const timeOf = (d: Date | null | undefined): number => {
  const t = d ? new Date(d).getTime() : NaN
  return Number.isNaN(t) ? -Infinity : t
}

/**
 * The one scoped read behind My Students and Student Performance. Ownership
 * comes from the signed-in user: faculty see the courses they own, of any
 * kind; an admin sees every course.
 */
async function loadScoped(
  filters: FacultyStudentFilters
): Promise<{ success: true; data: Scoped } | { success: false; error: string }> {
  await connectDB()
  const me = await getCurrentUser()
  if (!me) return { success: false, error: "You need to be signed in" }
  if (me.role !== "INSTRUCTOR" && me.role !== "ADMIN") return { success: false, error: "Instructors only" }
  const f = parseStudentFilters({
    program: filters?.program ?? undefined,
    plan: filters?.plan ?? undefined,
    cohort: filters?.cohort == null ? undefined : String(filters.cohort),
  })

  const admin = me.role === "ADMIN"
  const scopeIds = admin
    ? null
    : (await Course.find({ instructor: me.id }).select("_id").lean()).map((c) => c._id)

  const all: LeanEnrollment[] =
    scopeIds && scopeIds.length === 0
      ? []
      : await Enrollment.find({
          ...(scopeIds ? { course: { $in: scopeIds } } : {}),
          status: { $in: ["active", "completed"] },
        })
          .select(
            "user course status packageKey progress bestScorePercent examPassed purchasedAt activatedAt createdAt lastAccessedAt"
          )
          .lean<LeanEnrollment[]>()

  const courseIds = [...new Set(all.map((r) => r.course.toString()))]
  const courses = courseIds.length ? await Course.find({ _id: { $in: courseIds } }).select("title format").lean() : []
  const courseOf = new Map(
    courses.map((c) => [c._id.toString(), { title: c.title as string, fileProduct: isFileFormat(c.format) }])
  )

  const cohortMap = await cohortsFor(all)
  const cohorts = [...new Map([...cohortMap.values()].map((c) => [c.number, c])).values()].sort(
    (a, b) => a.number - b.number
  )

  const filtered = all
    .filter((r) => !f.program || r.course.toString() === f.program)
    .filter((r) => !f.plan || planOf(r.packageKey).key === f.plan)
    .filter((r) => f.cohort === null || cohortMap.get(r._id.toString())?.number === f.cohort)

  return { success: true, data: { admin, all, filtered, courseOf, cohortMap, cohorts } }
}

/** The filter's program list: every program with a learner in scope, by title. */
function programsOf(rows: LeanEnrollment[], s: Scoped): { id: string; title: string }[] {
  return [...new Set(rows.map((r) => r.course.toString()))]
    .map((id) => ({ id, title: s.courseOf.get(id)?.title ?? "Untitled program" }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** What the ranking and the summaries read, from the lean row alone (no query). */
function performanceFacts(r: LeanEnrollment, s: Scoped, masteryMap: Map<string, MasteryResult>): PerformanceRow {
  const id = r._id.toString()
  const m = masteryMap.get(id)
  return {
    program: { id: r.course.toString(), title: s.courseOf.get(r.course.toString())?.title ?? "Untitled program" },
    status: r.status === "completed" ? "completed" : "active",
    progress: r.progress ?? 0,
    enrolledAt: isoOrNull(r.activatedAt ?? r.purchasedAt ?? r.createdAt),
    lastActiveAt: isoOrNull(r.lastAccessedAt),
    cohort: s.cohortMap.get(id) ?? null,
    bestExam:
      r.bestScorePercent !== null && r.bestScorePercent !== undefined
        ? { percent: r.bestScorePercent, passed: Boolean(r.examPassed) }
        : null,
    attendance: m?.parts.find((p) => p.key === "attendance")?.value ?? null,
    mastery: m?.score ?? null,
  }
}

/** The rendered rows, in the order given: names and graded work for these rows only (two reads). */
async function toRows(
  rows: LeanEnrollment[],
  s: Scoped,
  masteryMap: Map<string, MasteryResult>
): Promise<FacultyStudentRow[]> {
  if (rows.length === 0) return []
  const [users, assignmentIds] = await Promise.all([
    User.find({ _id: { $in: rows.map((r) => r.user) } })
      .select("firstName lastName avatarUrl")
      .lean(),
    Assignment.find({ course: { $in: [...new Set(rows.map((r) => r.course))] } })
      .select("_id")
      .lean()
      .then((list) => list.map((a) => a._id)),
  ])
  const graded = assignmentIds.length
    ? await Submission.aggregate<{ _id: Types.ObjectId; graded: number; average: number }>([
        {
          $match: {
            assignment: { $in: assignmentIds },
            enrollment: { $in: rows.map((r) => r._id) },
            status: "graded",
          },
        },
        { $group: { _id: "$enrollment", graded: { $sum: 1 }, average: { $avg: "$grade" } } },
      ])
    : []
  const gradedBy = new Map(graded.map((g) => [g._id.toString(), g]))
  const userBy = new Map(users.map((u) => [u._id.toString(), u]))

  return rows.map((r) => {
    const id = r._id.toString()
    const u = userBy.get(r.user.toString())
    const g = gradedBy.get(id)
    const facts = performanceFacts(r, s, masteryMap)
    return {
      ...facts,
      enrollmentId: id,
      learner: {
        name: u ? `${u.firstName} ${u.lastName}`.trim() || "Learner" : "Learner",
        avatarUrl: u?.avatarUrl ?? null,
      },
      plan: planOf(r.packageKey),
      cohort: s.cohortMap.get(id) ?? null,
      assignments: { graded: g?.graded ?? 0, average: g ? Math.round(g.average) : null },
    }
  })
}

export async function getFacultyStudents(
  filters: FacultyStudentFilters
): Promise<{ success: true; data: FacultyStudentsView } | { success: false; error: string }> {
  try {
    const scoped = await loadScoped(filters)
    if (!scoped.success) return scoped
    const s = scoped.data

    // Most recently active first; the list shows the first MAX_ROWS.
    const sorted = [...s.filtered].sort((a, b) => {
      const la = timeOf(a.lastAccessedAt)
      const lb = timeOf(b.lastAccessedAt)
      if (la !== lb) return lb > la ? 1 : -1
      const pa = timeOf(a.purchasedAt ?? a.createdAt)
      const pb = timeOf(b.purchasedAt ?? b.createdAt)
      return pa === pb ? 0 : pb > pa ? 1 : -1
    })
    const capped = sorted.slice(0, MAX_ROWS)
    const masteryMap = await masteryFor(capped)
    const rows = await toRows(capped, s, masteryMap)

    return {
      success: true,
      data: {
        scope: s.admin ? "all" : "own",
        programs: programsOf(s.all, s),
        cohorts: s.cohorts,
        masteryReady: masteryMap.size > 0,
        rows,
        total: sorted.length,
        truncated: sorted.length > MAX_ROWS,
      },
    }
  } catch (e) {
    console.error("[getFacultyStudents]", e)
    return { success: false, error: "Could not load your students" }
  }
}

export type PerformanceOverview = Omit<FacultyStudentsView, "rows"> & {
  summaries: ProgramSummary[]
  attention: (FacultyStudentRow & { reasons: AttentionReason[] })[]
  rest: FacultyStudentRow[]
  /** Every learner who needs attention, including any past the rendered cap. */
  attentionTotal: number
}

/**
 * Student Performance across learners: My Students' scope and filters, less
 * file products (templates and guides have no lessons or activity to
 * measure). The summaries and the ranking cover every filtered learner; only
 * the rendered list stops at MAX_ROWS, needs-attention first.
 */
export async function getStudentPerformanceOverview(
  filters: FacultyStudentFilters
): Promise<{ success: true; data: PerformanceOverview } | { success: false; error: string }> {
  try {
    const scoped = await loadScoped(filters)
    if (!scoped.success) return scoped
    const s = scoped.data
    const measured = (r: LeanEnrollment) => !s.courseOf.get(r.course.toString())?.fileProduct
    const rows = s.filtered.filter(measured)

    const masteryMap = await masteryFor(rows)
    const masteryReady = masteryMap.size > 0
    const view = performanceOverview(
      rows.map((lean) => ({ ...performanceFacts(lean, s, masteryMap), lean })),
      Date.now(),
      masteryReady,
      MAX_ROWS
    )
    const shown = await toRows([...view.attention, ...view.rest].map((x) => x.lean), s, masteryMap)

    return {
      success: true,
      data: {
        scope: s.admin ? "all" : "own",
        programs: programsOf(s.all.filter(measured), s),
        cohorts: s.cohorts,
        masteryReady,
        total: view.total,
        truncated: view.truncated,
        summaries: view.summaries,
        attention: shown.slice(0, view.attention.length).map((row, i) => ({ ...row, reasons: view.attention[i].reasons })),
        rest: shown.slice(view.attention.length),
        attentionTotal: view.attentionTotal,
      },
    }
  } catch (e) {
    console.error("[getStudentPerformanceOverview]", e)
    return { success: false, error: "Could not load student performance" }
  }
}

export type StudentPerformance = {
  enrollmentId: string
  learner: { name: string; avatarUrl: string | null }
  program: { id: string; title: string; manageHref: string }
  plan: { key: PlanFilter; label: string }
  status: EnrollmentStatus
  cohort: CohortTag | null
  /** Null when the row carries no usable date. */
  enrolledAt: string | null
  lastActiveAt: string | null
  completedAt: string | null
  progress: number
  certificateId: string | null
  lessons: { id: string; title: string; section: string | null; completed: boolean; locked: boolean }[]
  exam: {
    passMark: number | null
    attempts: {
      id: string
      title: string
      scope: "final" | "lesson"
      attemptNumber: number
      status: AttemptStatus
      scorePercent: number | null
      at: string
    }[]
  }
  assignments: {
    id: string
    title: string
    dueAt: string | null
    submission: {
      status: "submitted" | "graded"
      grade: number | null
      feedback: string
      submittedAt: string
      gradedAt: string | null
    } | null
  }[]
  classes: { id: string; title: string; heldAt: string }[]
  mastery: MasteryResult | null
  mentorship: { roadmap: string | null; updatedAt: string | null; href: "/instructor/meetings#mentorship" } | null
}

const NOT_FOUND = { success: false, error: "Learner not found", code: "not_found" } as const
/** Never throws: a missing or invalid date reads as null. */
const iso = isoOrNull

/**
 * One learner's lessons, exams, assignments, classes and roadmap. The caller
 * must teach the course (an admin may open any); every other failure reads as
 * "not found", so nothing reveals whether the enrollment exists.
 */
export async function getStudentPerformance(
  enrollmentId: string
): Promise<{ success: true; data: StudentPerformance } | { success: false; error: string; code?: "not_found" }> {
  try {
    await connectDB()
    const me = await getCurrentUser()
    if (!me) return { success: false, error: "You need to be signed in" }
    if (me.role !== "INSTRUCTOR" && me.role !== "ADMIN") return { success: false, error: "Instructors only" }
    if (typeof enrollmentId !== "string" || !/^[a-f0-9]{24}$/.test(enrollmentId)) return NOT_FOUND

    const enrollment = await Enrollment.findById(enrollmentId).lean()
    if (!enrollment) return NOT_FOUND
    const course = await Course.findById(enrollment.course).select("title instructor packages examRequired").lean()
    if (!course) return NOT_FOUND
    if (me.role !== "ADMIN" && course.instructor?.toString() !== me.id) return NOT_FOUND

    const row: SeamEnrollment = enrollment as unknown as SeamEnrollment
    const [learner, lessons, attempts, finalExam, assignments, classes, cohortMap, masteryMap] = await Promise.all([
      User.findById(enrollment.user).select("firstName lastName avatarUrl").lean(),
      Lesson.find({ course: course._id, isPublished: true })
        .sort({ order: 1 })
        .select("title sectionTitle order isFree minPackageKey")
        .lean(),
      ExamAttempt.find({ enrollment: enrollment._id, status: { $ne: "in_progress" } })
        .populate<{ exam: { title: string; scope: "final" | "lesson" } | null }>("exam", "title scope")
        .sort({ createdAt: -1 })
        .lean(),
      Exam.findOne({ course: course._id, scope: "final" }).select("settings.passMarkPercent").lean(),
      Assignment.find({ course: course._id, status: "published" }).sort({ createdAt: 1 }).lean(),
      Meeting.find({
        courseId: course._id,
        mentorshipSessionId: null,
        startedAt: { $gte: enrollment.activatedAt ?? enrollment.purchasedAt },
      })
        .select("title startedAt")
        .sort({ startedAt: -1 })
        .limit(50)
        .lean(),
      cohortsFor([row]),
      masteryFor([row]),
    ])
    const submissions = assignments.length
      ? await Submission.find({ assignment: { $in: assignments.map((a) => a._id) }, user: enrollment.user }).lean()
      : []
    const subBy = new Map(submissions.map((s) => [s.assignment.toString(), s]))
    const done = new Set((enrollment.completedLessons ?? []).map((l) => l.toString()))
    const id = enrollment._id.toString()
    const mentor = includesMentorship(course, enrollment)

    return {
      success: true,
      data: {
        enrollmentId: id,
        learner: {
          name: learner ? `${learner.firstName} ${learner.lastName}`.trim() || "Learner" : "Learner",
          avatarUrl: learner?.avatarUrl ?? null,
        },
        program: { id: course._id.toString(), title: course.title, manageHref: `/instructor/courses/${course._id}` },
        plan: planOf(enrollment.packageKey),
        status: enrollment.status,
        cohort: cohortMap.get(id) ?? null,
        enrolledAt: iso(enrollment.activatedAt ?? enrollment.purchasedAt ?? enrollment.createdAt),
        lastActiveAt: iso(enrollment.lastAccessedAt),
        completedAt: iso(enrollment.completedAt),
        progress: enrollment.progress ?? 0,
        certificateId: enrollment.certificateId ?? null,
        lessons: lessons.map((l) => ({
          id: l._id.toString(),
          title: l.title,
          section: l.sectionTitle ?? null,
          completed: done.has(l._id.toString()),
          locked: !canAccessLesson(course, l, enrollment),
        })),
        exam: {
          passMark: finalExam?.settings?.passMarkPercent ?? null,
          attempts: attempts.map((a) => ({
            id: a._id.toString(),
            title: a.exam?.title ?? "Exam",
            scope: a.exam?.scope ?? "final",
            attemptNumber: a.attemptNumber,
            status: a.status,
            scorePercent: a.scorePercent ?? null,
            at: new Date(a.submittedAt ?? a.startedAt).toISOString(),
          })),
        },
        assignments: assignments.map((a) => {
          const s = subBy.get(a._id.toString())
          return {
            id: a._id.toString(),
            title: a.title,
            dueAt: iso(a.dueAt),
            submission: s
              ? {
                  status: s.status,
                  grade: s.grade ?? null,
                  feedback: s.feedback ?? "",
                  submittedAt: new Date(s.submittedAt).toISOString(),
                  gradedAt: iso(s.gradedAt),
                }
              : null,
          }
        }),
        classes: classes.flatMap((c) =>
          c.startedAt ? [{ id: c._id.toString(), title: c.title, heldAt: new Date(c.startedAt).toISOString() }] : []
        ),
        mastery: masteryMap.get(id) ?? null,
        mentorship: mentor
          ? {
              roadmap: enrollment.mentorRoadmap?.text ?? null,
              updatedAt: iso(enrollment.mentorRoadmap?.updatedAt),
              href: "/instructor/meetings#mentorship",
            }
          : null,
      },
    }
  } catch (e) {
    console.error("[getStudentPerformance]", e)
    return { success: false, error: "Could not load this learner" }
  }
}
