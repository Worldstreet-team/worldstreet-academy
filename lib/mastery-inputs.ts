import "server-only"
import { Types, isValidObjectId } from "mongoose"
import { Assignment, Attendance, Course, Enrollment, Meeting, Submission, type ICoursePackage, type PackageKey } from "@/lib/db/models"
import { attendancePercent, attendedSeconds, classAttended, classHeld } from "@/lib/attendance-rules"
import { courseKindOf } from "@/lib/course-kind"
import { isFileFormat, type CourseFormat } from "@/lib/course-format"
import { entitlementsFor } from "@/lib/entitlements"
import {
  MASTERY_KEYS,
  masteryView,
  type MasteryFacts,
  type MasteryInputs,
  type MasteryKey,
  type MyMastery,
} from "@/lib/mastery-score"

/**
 * The one loader behind every Mastery Score surface (D24, institutional
 * blueprint §12), and the one Phases 17 and 19 read. Server-only and never a
 * "use server" module: as actions these would let anyone read anyone's score.
 * Callers have run `connectDB()`. The score is computed on read, never stored.
 */

type Id = Types.ObjectId | string

export type MasteryEnrollmentRow = {
  _id: Id
  user: Id
  course: Id
  packageKey?: PackageKey | null
  progress?: number | null
  bestScorePercent?: number | null
  activatedAt?: Date | null
  purchasedAt?: Date | null
  createdAt?: Date | null
}

// `format` is required, as in entitlementsFor: callers select it beside `packages`.
export type MasteryCourseRow = { _id: Id; packages?: ICoursePackage[] | null; format: CourseFormat | null | undefined }

const key = (id: Id): string => String(id)

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length
}

/** Score facts for each enrollment, keyed by enrollment id. Four queries at most, whatever the list length. */
export async function masteryInputsForMany(
  rows: { enrollment: MasteryEnrollmentRow; course: MasteryCourseRow }[]
): Promise<Map<string, MasteryFacts>> {
  const out = new Map<string, MasteryFacts>()
  if (rows.length === 0) return out

  // A template or guide (a file product) has no Mastery Score: no facts at all.
  const plans = rows.filter(({ course }) => !isFileFormat(course.format)).map(({ enrollment, course }) => ({
    enrollment,
    ent: entitlementsFor(course, enrollment),
    windowStart: enrollment.activatedAt ?? enrollment.purchasedAt ?? enrollment.createdAt ?? new Date(0),
  }))

  // Graded work, for the plans that include assignments.
  const gradedPlans = plans.filter((p) => p.ent.assignments)
  const gradeByPair = new Map<string, { assignment: string; grade: number }[]>()
  // Legacy assignments carry no `kind`: only an explicit "project" is a project.
  const projectIds = new Set<string>()
  if (gradedPlans.length > 0) {
    const submissions = await Submission.find({
      user: { $in: [...new Set(gradedPlans.map((p) => key(p.enrollment.user)))] },
      course: { $in: [...new Set(gradedPlans.map((p) => key(p.enrollment.course)))] },
      status: "graded",
      grade: { $ne: null },
    })
      .select("user course assignment grade")
      .lean()
    for (const s of submissions) {
      if (typeof s.grade !== "number") continue
      const pair = `${key(s.user)}:${key(s.course)}`
      const list = gradeByPair.get(pair) ?? []
      list.push({ assignment: key(s.assignment), grade: s.grade })
      gradeByPair.set(pair, list)
    }
    const assignmentIds = [...new Set(submissions.map((s) => key(s.assignment)))]
    if (assignmentIds.length > 0) {
      const projects = await Assignment.find({ _id: { $in: assignmentIds }, kind: "project" }).select("_id").lean()
      for (const a of projects) projectIds.add(key(a._id))
    }
  }

  // Held classes and the learner's attendance, for the plans with live classes.
  const livePlans = plans.filter((p) => p.ent.liveClasses)
  const heldByCourse = new Map<string, { id: string; startedAt: Date; endedAt: Date; seconds: number }[]>()
  const attendanceByPair = new Map<string, { seconds: number; openSince: Date | null }>()
  if (livePlans.length > 0) {
    const earliest = new Date(Math.min(...livePlans.map((p) => p.windowStart.getTime())))
    const meetings = await Meeting.find({
      courseId: { $in: [...new Set(livePlans.map((p) => key(p.enrollment.course)))] },
      mentorshipSessionId: null,
      status: "ended",
      startedAt: { $ne: null, $gte: earliest },
      endedAt: { $ne: null },
    })
      .select("courseId startedAt endedAt")
      .lean()
    const heldIds: string[] = []
    for (const m of meetings) {
      if (!m.courseId || !m.startedAt || !m.endedAt) continue
      const seconds = (m.endedAt.getTime() - m.startedAt.getTime()) / 1000
      if (!classHeld(seconds)) continue
      const list = heldByCourse.get(key(m.courseId)) ?? []
      list.push({ id: key(m._id), startedAt: m.startedAt, endedAt: m.endedAt, seconds })
      heldByCourse.set(key(m.courseId), list)
      heldIds.push(key(m._id))
    }
    if (heldIds.length > 0) {
      const attendances = await Attendance.find({
        meeting: { $in: heldIds },
        user: { $in: [...new Set(livePlans.map((p) => key(p.enrollment.user)))] },
      })
        .select("meeting user seconds openSince")
        .lean()
      for (const a of attendances) {
        attendanceByPair.set(`${key(a.meeting)}:${key(a.user)}`, { seconds: a.seconds, openSince: a.openSince ?? null })
      }
    }
  }

  for (const { enrollment, ent, windowStart } of plans) {
    const excluded: MasteryKey[] = []
    if (!ent.certificate) excluded.push("assessment")
    if (!ent.assignments) excluded.push("assignments", "projects")
    if (!ent.liveClasses) excluded.push("attendance")

    const inputs: MasteryInputs = {
      completion: enrollment.progress ?? 0,
      assessment: ent.certificate ? (enrollment.bestScorePercent ?? null) : null,
      assignments: null,
      projects: null,
      attendance: null,
    }

    let bestProjectGrade: number | null = null
    if (ent.assignments) {
      const graded = gradeByPair.get(`${key(enrollment.user)}:${key(enrollment.course)}`) ?? []
      const plain = graded.filter((g) => !projectIds.has(g.assignment)).map((g) => g.grade)
      const projects = graded.filter((g) => projectIds.has(g.assignment)).map((g) => g.grade)
      inputs.assignments = mean(plain)
      inputs.projects = mean(projects)
      bestProjectGrade = projects.length > 0 ? Math.max(...projects) : null
    }

    let classes: MasteryFacts["classes"] = null
    if (ent.liveClasses) {
      const held = (heldByCourse.get(key(enrollment.course)) ?? []).filter((c) => c.startedAt >= windowStart)
      let attended = 0
      for (const c of held) {
        const row = attendanceByPair.get(`${c.id}:${key(enrollment.user)}`)
        if (row && classAttended(attendedSeconds(row, c.endedAt), c.seconds)) attended += 1
      }
      classes = { attended, held: held.length }
      inputs.attendance = attendancePercent(attended, held.length)
    }

    out.set(key(enrollment._id), {
      inputs,
      excluded: MASTERY_KEYS.filter((k) => excluded.includes(k)),
      classes,
      bestProjectGrade,
    })
  }
  return out
}

export async function masteryInputsFor(enrollment: MasteryEnrollmentRow, course: MasteryCourseRow): Promise<MasteryFacts> {
  const facts = (await masteryInputsForMany([{ enrollment, course }])).get(key(enrollment._id))
  if (!facts) throw new Error("Mastery facts missing for the enrollment")
  return facts
}

/** The learner's Academy programs (active or completed), most recently opened first. */
export async function myMastery(userId: string): Promise<MyMastery[]> {
  if (!isValidObjectId(userId)) return []
  const enrollments = await Enrollment.find({ user: userId, status: { $in: ["active", "completed"] } })
    .sort({ lastAccessedAt: -1, createdAt: -1 })
    .select("user course packageKey progress bestScorePercent activatedAt purchasedAt createdAt")
    .lean()
  if (enrollments.length === 0) return []
  const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.course) } })
    .select("title packages kind format")
    .lean()
  const byId = new Map(courses.map((c) => [key(c._id), c]))
  const pairs = enrollments.flatMap((enrollment) => {
    const course = byId.get(key(enrollment.course))
    return course && courseKindOf(course) === "program" ? [{ enrollment, course }] : []
  })
  const facts = await masteryInputsForMany(pairs)
  return pairs.flatMap(({ enrollment, course }) => {
    const f = facts.get(key(enrollment._id))
    return f
      ? [{ enrollmentId: key(enrollment._id), courseId: key(course._id), courseTitle: course.title, ...masteryView(f) }]
      : []
  })
}
