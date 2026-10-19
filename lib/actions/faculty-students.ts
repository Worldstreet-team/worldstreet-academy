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
  type FacultyStudentFilters,
  type PlanFilter,
} from "@/lib/faculty-students"
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

export async function getFacultyStudents(
  filters: FacultyStudentFilters
): Promise<{ success: true; data: FacultyStudentsView } | { success: false; error: string }> {
  try {
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
    const courses = courseIds.length ? await Course.find({ _id: { $in: courseIds } }).select("title").lean() : []
    const titleOf = new Map(courses.map((c) => [c._id.toString(), c.title as string]))
    const programs = courseIds
      .map((id) => ({ id, title: titleOf.get(id) ?? "Untitled program" }))
      .sort((a, b) => a.title.localeCompare(b.title))

    const cohortMap = await cohortsFor(all)
    const cohorts = [...new Map([...cohortMap.values()].map((c) => [c.number, c])).values()].sort(
      (a, b) => a.number - b.number
    )

    const filtered = all
      .filter((r) => !f.program || r.course.toString() === f.program)
      .filter((r) => !f.plan || planOf(r.packageKey).key === f.plan)
      .filter((r) => f.cohort === null || cohortMap.get(r._id.toString())?.number === f.cohort)
      .sort((a, b) => {
        const la = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : -Infinity
        const lb = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : -Infinity
        if (la !== lb) return lb > la ? 1 : -1
        return new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
      })

    const total = filtered.length
    const capped = filtered.slice(0, MAX_ROWS)

    const cappedCourseIds = [...new Set(capped.map((r) => r.course))]
    const [users, assignmentIds, masteryMap] = await Promise.all([
      capped.length
        ? User.find({ _id: { $in: capped.map((r) => r.user) } })
            .select("firstName lastName avatarUrl")
            .lean()
        : [],
      capped.length
        ? Assignment.find({ course: { $in: cappedCourseIds } })
            .select("_id")
            .lean()
            .then((rows) => rows.map((r) => r._id))
        : [],
      masteryFor(capped),
    ])
    const graded = assignmentIds.length
      ? await Submission.aggregate<{ _id: Types.ObjectId; graded: number; average: number }>([
          {
            $match: {
              assignment: { $in: assignmentIds },
              enrollment: { $in: capped.map((r) => r._id) },
              status: "graded",
            },
          },
          { $group: { _id: "$enrollment", graded: { $sum: 1 }, average: { $avg: "$grade" } } },
        ])
      : []
    const gradedBy = new Map(graded.map((g) => [g._id.toString(), g]))
    const userBy = new Map(users.map((u) => [u._id.toString(), u]))

    const rows: FacultyStudentRow[] = capped.map((r) => {
      const id = r._id.toString()
      const u = userBy.get(r.user.toString())
      const g = gradedBy.get(id)
      const m = masteryMap.get(id)
      return {
        enrollmentId: id,
        learner: {
          name: u ? `${u.firstName} ${u.lastName}`.trim() || "Learner" : "Learner",
          avatarUrl: u?.avatarUrl ?? null,
        },
        program: { id: r.course.toString(), title: titleOf.get(r.course.toString()) ?? "Untitled program" },
        plan: planOf(r.packageKey),
        status: r.status === "completed" ? "completed" : "active",
        cohort: cohortMap.get(id) ?? null,
        progress: r.progress ?? 0,
        lastActiveAt: r.lastAccessedAt ? new Date(r.lastAccessedAt).toISOString() : null,
        bestExam:
          r.bestScorePercent !== null && r.bestScorePercent !== undefined
            ? { percent: r.bestScorePercent, passed: Boolean(r.examPassed) }
            : null,
        assignments: { graded: g?.graded ?? 0, average: g ? Math.round(g.average) : null },
        attendance: m?.parts.find((p) => p.key === "attendance")?.value ?? null,
        mastery: m?.score ?? null,
      }
    })

    return {
      success: true,
      data: {
        scope: admin ? "all" : "own",
        programs,
        cohorts,
        masteryReady: masteryMap.size > 0,
        rows,
        total,
        truncated: total > MAX_ROWS,
      },
    }
  } catch (e) {
    console.error("[getFacultyStudents]", e)
    return { success: false, error: "Could not load your students" }
  }
}

export type StudentPerformance = {
  enrollmentId: string
  learner: { name: string; avatarUrl: string | null }
  program: { id: string; title: string; manageHref: string }
  plan: { key: PlanFilter; label: string }
  status: EnrollmentStatus
  cohort: CohortTag | null
  enrolledAt: string
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
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null)

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
        enrolledAt: new Date(enrollment.activatedAt ?? enrollment.purchasedAt).toISOString(),
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
