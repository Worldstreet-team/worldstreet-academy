"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { Types, type HydratedDocument } from "mongoose"
import connectDB from "@/lib/db"
import {
  Exam,
  Question,
  ExamAttempt,
  Course,
  Enrollment,
  type IExamSettings,
  type QuestionType,
  type AttemptStatus,
} from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { notifyUser } from "@/lib/notify"

/* ═══════════════════ helpers ═══════════════════ */

async function initAction() {
  const [, currentUser] = await Promise.all([connectDB(), getCurrentUser()])
  return currentUser
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Course owner or ADMIN — the instructor-side authz gate. */
async function requireCourseOwner(courseId: string) {
  const user = await initAction()
  if (!user) throw new Error("Not authenticated")
  const course = await Course.findById(courseId).select("instructor title examRequired status")
  if (!course) throw new Error("Course not found")
  if (course.instructor.toString() !== user.id && user.role !== "ADMIN") {
    throw new Error("Not your course")
  }
  return { user, course }
}

/** Filter for the two exam flavors: course final vs per-lesson knowledge check. */
function examFilter(courseId: string, lessonId?: string | null) {
  return lessonId
    ? { course: courseId, scope: "lesson" as const, lesson: lessonId }
    : { course: courseId, scope: "final" as const }
}

/* ═══════════════════ instructor: exam builder ═══════════════════ */

export type ExamSettingsInput = Partial<IExamSettings>

export type InstructorQuestion = {
  id: string
  type: QuestionType
  prompt: string
  options: { id: string; text: string }[]
  correctOptionIds: string[]
  points: number
  order: number
}

export type InstructorExam = {
  id: string
  courseId: string
  scope: "final" | "lesson"
  lessonId: string | null
  title: string
  instructions: string
  status: "draft" | "published"
  settings: IExamSettings
  questionCount: number
  totalPoints: number
  examRequired: boolean
  questions: InstructorQuestion[]
}

export async function getCourseExamForInstructor(
  courseId: string,
  lessonId?: string | null
): Promise<InstructorExam | null> {
  try {
    const { course } = await requireCourseOwner(courseId)
    const exam = await Exam.findOne(examFilter(courseId, lessonId))
    if (!exam) return null

    const questions = await Question.find({ exam: exam._id })
      .select("+correctOptionIds")
      .sort({ order: 1, createdAt: 1 })

    return {
      id: exam._id.toString(),
      courseId,
      scope: (exam.scope ?? "final") as "final" | "lesson",
      lessonId: exam.lesson ? exam.lesson.toString() : null,
      title: exam.title,
      instructions: exam.instructions,
      status: exam.status,
      settings: exam.settings,
      questionCount: exam.questionCount,
      totalPoints: exam.totalPoints,
      examRequired: !!course.examRequired,
      questions: questions.map((q) => ({
        id: q._id.toString(),
        type: q.type,
        prompt: q.prompt,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        correctOptionIds: q.correctOptionIds,
        points: q.points,
        order: q.order,
      })),
    }
  } catch (error) {
    console.error("Get instructor exam error:", error)
    return null
  }
}

export async function upsertExam(
  courseId: string,
  input: { title: string; instructions?: string; settings?: ExamSettingsInput; lessonId?: string | null }
) {
  try {
    const { user, course } = await requireCourseOwner(courseId)

    const title = input.title?.trim()
    if (!title || title.length < 3) return { success: false, error: "Give the exam a title" }

    if (input.lessonId) {
      const { Lesson } = await import("@/lib/db/models")
      const lesson = await Lesson.findOne({ _id: input.lessonId, course: courseId }).select("_id")
      if (!lesson) return { success: false, error: "Lesson not found in this course" }
    }

    const exam = await Exam.findOneAndUpdate(
      examFilter(courseId, input.lessonId),
      {
        $set: {
          title,
          instructions: input.instructions?.trim() ?? "",
          ...(input.settings
            ? Object.fromEntries(
                Object.entries(input.settings).map(([k, v]) => [`settings.${k}`, v])
              )
            : {}),
        },
        $setOnInsert: {
          course: course._id,
          scope: input.lessonId ? "lesson" : "final",
          lesson: input.lessonId ?? null,
          instructor: user.id,
          status: "draft",
        },
      },
      { new: true, upsert: true }
    )

    revalidatePath(`/instructor/courses/${courseId}/exam`)
    return { success: true, examId: exam._id.toString() }
  } catch (error) {
    console.error("Upsert exam error:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to save exam" }
  }
}

async function refreshExamCounters(examId: Types.ObjectId) {
  const agg = await Question.aggregate([
    { $match: { exam: examId } },
    { $group: { _id: null, count: { $sum: 1 }, points: { $sum: "$points" } } },
  ])
  await Exam.updateOne(
    { _id: examId },
    { $set: { questionCount: agg[0]?.count ?? 0, totalPoints: agg[0]?.points ?? 0 } }
  )
}

export type QuestionInput = {
  type: QuestionType
  prompt: string
  options: string[]
  /** Indexes into `options` that are correct. */
  correctIndexes: number[]
  points?: number
}

function validateQuestion(input: QuestionInput): string | null {
  if (!input.prompt?.trim() || input.prompt.trim().length < 5) return "Question prompt is too short"
  const opts = (input.options ?? []).map((o) => o.trim()).filter(Boolean)
  if (opts.length < 2) return "Add at least two options"
  if (opts.length > 8) return "At most 8 options"
  const correct = [...new Set(input.correctIndexes ?? [])].filter((i) => i >= 0 && i < opts.length)
  if (correct.length === 0) return "Mark at least one correct option"
  if (input.type === "single" && correct.length !== 1) return "Single-choice questions need exactly one correct option"
  return null
}

export async function addExamQuestion(courseId: string, input: QuestionInput, lessonId?: string | null) {
  try {
    await requireCourseOwner(courseId)
    const exam = await Exam.findOne(examFilter(courseId, lessonId))
    if (!exam) return { success: false, error: "Create the exam first" }

    const invalid = validateQuestion(input)
    if (invalid) return { success: false, error: invalid }

    const opts = input.options.map((o) => o.trim()).filter(Boolean)
    const options = opts.map((text) => ({ id: randomUUID().slice(0, 8), text }))
    const correctOptionIds = [...new Set(input.correctIndexes)]
      .filter((i) => i >= 0 && i < options.length)
      .map((i) => options[i].id)

    const last = await Question.findOne({ exam: exam._id }).sort({ order: -1 }).select("order")
    await Question.create({
      exam: exam._id,
      type: input.type,
      prompt: input.prompt.trim(),
      options,
      correctOptionIds,
      points: Math.max(1, Math.min(100, input.points ?? 1)),
      order: (last?.order ?? 0) + 1,
    })
    await refreshExamCounters(exam._id)

    revalidatePath(`/instructor/courses/${courseId}/exam`)
    return { success: true }
  } catch (error) {
    console.error("Add question error:", error)
    return { success: false, error: "Failed to add question" }
  }
}

export async function updateExamQuestion(
  courseId: string,
  questionId: string,
  input: QuestionInput,
  lessonId?: string | null
) {
  try {
    await requireCourseOwner(courseId)
    const exam = await Exam.findOne(examFilter(courseId, lessonId)).select("_id")
    if (!exam) return { success: false, error: "Exam not found" }

    const invalid = validateQuestion(input)
    if (invalid) return { success: false, error: invalid }

    const opts = input.options.map((o) => o.trim()).filter(Boolean)
    const options = opts.map((text) => ({ id: randomUUID().slice(0, 8), text }))
    const correctOptionIds = [...new Set(input.correctIndexes)]
      .filter((i) => i >= 0 && i < options.length)
      .map((i) => options[i].id)

    const updated = await Question.findOneAndUpdate(
      { _id: questionId, exam: exam._id },
      {
        $set: {
          type: input.type,
          prompt: input.prompt.trim(),
          options,
          correctOptionIds,
          points: Math.max(1, Math.min(100, input.points ?? 1)),
        },
      }
    )
    if (!updated) return { success: false, error: "Question not found" }
    await refreshExamCounters(exam._id)

    revalidatePath(`/instructor/courses/${courseId}/exam`)
    return { success: true }
  } catch (error) {
    console.error("Update question error:", error)
    return { success: false, error: "Failed to update question" }
  }
}

export async function deleteExamQuestion(courseId: string, questionId: string, lessonId?: string | null) {
  try {
    await requireCourseOwner(courseId)
    const exam = await Exam.findOne(examFilter(courseId, lessonId)).select("_id")
    if (!exam) return { success: false, error: "Exam not found" }

    await Question.deleteOne({ _id: questionId, exam: exam._id })
    await refreshExamCounters(exam._id)

    revalidatePath(`/instructor/courses/${courseId}/exam`)
    return { success: true }
  } catch (error) {
    console.error("Delete question error:", error)
    return { success: false, error: "Failed to delete question" }
  }
}

export async function setExamPublished(courseId: string, published: boolean, lessonId?: string | null) {
  try {
    await requireCourseOwner(courseId)
    const exam = await Exam.findOne(examFilter(courseId, lessonId))
    if (!exam) return { success: false, error: "Create the exam first" }

    if (published && exam.questionCount === 0) {
      return { success: false, error: "Add at least one question before publishing" }
    }
    exam.status = published ? "published" : "draft"
    await exam.save()

    // Unpublishing a FINAL exam that gates completion would strand students —
    // flip the gate off with it. (Lesson quizzes never gate anything in v1.)
    if (!published && (exam.scope ?? "final") === "final") {
      await Course.updateOne({ _id: courseId }, { $set: { examRequired: false } })
    }

    revalidatePath(`/instructor/courses/${courseId}/exam`)
    return { success: true }
  } catch (error) {
    console.error("Publish exam error:", error)
    return { success: false, error: "Failed to update exam" }
  }
}

export async function setCourseExamRequired(courseId: string, required: boolean) {
  try {
    await requireCourseOwner(courseId)
    if (required) {
      const exam = await Exam.findOne({ course: courseId, scope: "final" }).select("status questionCount")
      if (!exam || exam.status !== "published" || exam.questionCount === 0) {
        return { success: false, error: "Publish the exam (with questions) before requiring it" }
      }
    }
    await Course.updateOne({ _id: courseId }, { $set: { examRequired: required } })
    revalidatePath(`/instructor/courses/${courseId}/exam`)
    return { success: true }
  } catch (error) {
    console.error("Set exam required error:", error)
    return { success: false, error: "Failed to update the requirement" }
  }
}

/* ═══════════════════ student: status + runner ═══════════════════ */

export type StudentExamStatus = {
  hasExam: boolean
  examRequired: boolean
  title: string
  instructions: string
  durationMinutes: number
  passMarkPercent: number
  maxAttempts: number
  questionCount: number
  attemptsUsed: number
  attemptsLeft: number | null
  examPassed: boolean
  bestScorePercent: number | null
  /** Lessons finished — the exam unlocks at 100%. */
  eligible: boolean
  progress: number
  activeAttemptId: string | null
  lastResult: { status: AttemptStatus; scorePercent: number | null } | null
}

export async function getStudentExamStatus(
  courseId: string,
  lessonId?: string | null
): Promise<StudentExamStatus | null> {
  try {
    const user = await initAction()
    if (!user) return null

    const [course, exam, enrollment] = await Promise.all([
      Course.findById(courseId).select("examRequired").lean(),
      Exam.findOne({ ...examFilter(courseId, lessonId), status: "published" }).lean(),
      Enrollment.findOne({ user: user.id, course: courseId, status: { $in: ["active", "completed"] } }).lean(),
    ])
    if (!course) return null
    const isLessonQuiz = !!lessonId
    if (!exam || !enrollment) {
      return {
        hasExam: !!exam,
        examRequired: !isLessonQuiz && !!course.examRequired,
        title: exam?.title ?? "",
        instructions: exam?.instructions ?? "",
        durationMinutes: exam?.settings.durationMinutes ?? 0,
        passMarkPercent: exam?.settings.passMarkPercent ?? 0,
        maxAttempts: exam?.settings.maxAttempts ?? 0,
        questionCount: exam?.questionCount ?? 0,
        attemptsUsed: 0,
        attemptsLeft: null,
        examPassed: false,
        bestScorePercent: null,
        eligible: false,
        progress: enrollment?.progress ?? 0,
        activeAttemptId: null,
        lastResult: null,
      }
    }

    const [attemptsUsed, active, last] = await Promise.all([
      ExamAttempt.countDocuments({ user: user.id, exam: exam._id, status: { $ne: "in_progress" } }),
      ExamAttempt.findOne({ user: user.id, exam: exam._id, status: "in_progress" }).select("_id").lean(),
      ExamAttempt.findOne({ user: user.id, exam: exam._id, status: { $ne: "in_progress" } })
        .sort({ createdAt: -1 })
        .select("status scorePercent")
        .lean(),
    ])

    const max = exam.settings.maxAttempts
    return {
      hasExam: true,
      examRequired: !isLessonQuiz && !!course.examRequired,
      title: exam.title,
      instructions: exam.instructions ?? "",
      durationMinutes: exam.settings.durationMinutes,
      passMarkPercent: exam.settings.passMarkPercent,
      maxAttempts: max,
      questionCount: exam.questionCount,
      attemptsUsed,
      attemptsLeft: max === 0 ? null : Math.max(0, max - attemptsUsed),
      examPassed: isLessonQuiz ? (last?.status === "passed") : !!enrollment.examPassed,
      bestScorePercent: isLessonQuiz ? (last?.scorePercent ?? null) : (enrollment.bestScorePercent ?? null),
      // Final exams unlock at 100% progress; knowledge checks just need enrollment.
      eligible: isLessonQuiz ? true : (enrollment.progress ?? 0) >= 100,
      progress: enrollment.progress ?? 0,
      activeAttemptId: active ? active._id.toString() : null,
      lastResult: last ? { status: last.status, scorePercent: last.scorePercent ?? null } : null,
    }
  } catch (error) {
    console.error("Get exam status error:", error)
    return null
  }
}

export type RunnerQuestion = {
  id: string
  type: QuestionType
  prompt: string
  points: number
  options: { id: string; text: string }[]
}

export type RunnerPayload = {
  attemptId: string
  deadlineAt: string
  durationMinutes: number
  passMarkPercent: number
  questions: RunnerQuestion[]
  savedAnswers: Record<string, string[]>
}

/** Grade an attempt in place (server-authoritative). */
async function gradeAttempt(attempt: HydratedDocument<import("@/lib/db/models").IExamAttempt>) {
  const exam = await Exam.findById(attempt.exam)
  if (!exam) throw new Error("Exam missing")

  const questions = await Question.find({ exam: attempt.exam }).select("+correctOptionIds")
  const answerMap = new Map<string, string[]>(
    attempt.answers.map((a: { question: Types.ObjectId; optionIds: string[] }) => [
      a.question.toString(),
      a.optionIds ?? [],
    ])
  )

  let pointsEarned = 0
  let pointsTotal = 0
  for (const q of questions) {
    pointsTotal += q.points
    const given = [...(answerMap.get(q._id.toString()) ?? [])].sort()
    const correct = [...q.correctOptionIds].sort()
    const isCorrect =
      given.length === correct.length && given.every((v, i) => v === correct[i])
    if (isCorrect) pointsEarned += q.points
  }

  const scorePercent = pointsTotal > 0 ? Math.round((pointsEarned / pointsTotal) * 100) : 0
  const passed = scorePercent >= exam.settings.passMarkPercent

  attempt.status = passed ? "passed" : "failed"
  attempt.submittedAt = new Date()
  attempt.scorePercent = scorePercent
  attempt.pointsEarned = pointsEarned
  attempt.pointsTotal = pointsTotal
  await attempt.save()

  // Enrollment side-effects — FINAL exams only. Lesson knowledge checks are
  // practice: their results live on the attempt rows alone.
  const enrollment =
    (exam.scope ?? "final") === "final" ? await Enrollment.findById(attempt.enrollment) : null
  if (enrollment) {
    const best = Math.max(enrollment.bestScorePercent ?? 0, scorePercent)
    enrollment.bestScorePercent = best
    if (passed && !enrollment.examPassed) {
      enrollment.examPassed = true
      enrollment.examPassedAt = new Date()
      // Completion may have been held back purely by the exam gate.
      if ((enrollment.progress ?? 0) >= 100 && enrollment.status === "active") {
        enrollment.status = "completed"
        enrollment.completedAt = new Date()
      }
    }
    await enrollment.save()
  }

  return { passed, scorePercent, pointsEarned, pointsTotal, showResults: exam.settings.showResults }
}

export async function startExamAttempt(
  courseId: string,
  lessonId?: string | null
): Promise<
  | { success: true; runner: RunnerPayload; resumed: boolean }
  | { success: false; error: string }
> {
  try {
    const user = await initAction()
    if (!user) return { success: false, error: "Not authenticated" }

    const exam = await Exam.findOne({ ...examFilter(courseId, lessonId), status: "published" })
    if (!exam) return { success: false, error: "This course has no published exam" }
    if (exam.questionCount === 0) return { success: false, error: "The exam has no questions yet" }

    const enrollment = await Enrollment.findOne({
      user: user.id,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })
    if (!enrollment) return { success: false, error: "You're not enrolled in this course" }
    if (!lessonId && (enrollment.progress ?? 0) < 100) {
      return { success: false, error: "Finish all lessons first — the exam unlocks at 100% progress" }
    }

    // Resume an in-flight attempt (deadline permitting).
    let attempt = await ExamAttempt.findOne({ user: user.id, exam: exam._id, status: "in_progress" })
    let resumed = false
    if (attempt) {
      if (attempt.deadlineAt.getTime() < Date.now()) {
        await gradeAttempt(attempt) // expired — grade what was saved
        attempt = null
      } else {
        resumed = true
      }
    }

    if (!attempt) {
      const finished = await ExamAttempt.countDocuments({
        user: user.id,
        exam: exam._id,
        status: { $ne: "in_progress" },
      })
      if (exam.settings.maxAttempts > 0 && finished >= exam.settings.maxAttempts) {
        return { success: false, error: "No attempts left for this exam" }
      }

      const questions = await Question.find({ exam: exam._id }).sort({ order: 1 })
      const ordered = exam.settings.shuffleQuestions ? shuffled(questions) : questions
      const optionOrder: Record<string, string[]> = {}
      for (const q of ordered) {
        const ids = q.options.map((o) => o.id)
        optionOrder[q._id.toString()] = exam.settings.shuffleOptions ? shuffled(ids) : ids
      }

      const startedAt = new Date()
      attempt = await ExamAttempt.create({
        user: user.id,
        exam: exam._id,
        course: courseId,
        enrollment: enrollment._id,
        attemptNumber: finished + 1,
        status: "in_progress",
        startedAt,
        deadlineAt: new Date(startedAt.getTime() + exam.settings.durationMinutes * 60_000),
        answers: [],
        questionOrder: ordered.map((q) => q._id),
        optionOrder,
      })
    }

    // Build the paper in snapshot order (no correct answers anywhere here).
    const questions = await Question.find({ exam: exam._id })
    const qMap = new Map(questions.map((q) => [q._id.toString(), q]))
    const runnerQuestions: RunnerQuestion[] = attempt.questionOrder
      .map((qid) => qMap.get(qid.toString()))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .map((q) => {
        const order = attempt!.optionOrder[q._id.toString()] ?? q.options.map((o) => o.id)
        const optMap = new Map(q.options.map((o) => [o.id, o.text]))
        return {
          id: q._id.toString(),
          type: q.type,
          prompt: q.prompt,
          points: q.points,
          options: order
            .filter((id) => optMap.has(id))
            .map((id) => ({ id, text: optMap.get(id)! })),
        }
      })

    return {
      success: true,
      resumed,
      runner: {
        attemptId: attempt._id.toString(),
        deadlineAt: attempt.deadlineAt.toISOString(),
        durationMinutes: exam.settings.durationMinutes,
        passMarkPercent: exam.settings.passMarkPercent,
        questions: runnerQuestions,
        savedAnswers: Object.fromEntries(
          attempt.answers.map((a) => [a.question.toString(), a.optionIds ?? []])
        ),
      },
    }
  } catch (error) {
    // Unique-index race (double-click start in two tabs) — resume instead.
    if ((error as { code?: number })?.code === 11000) {
      return { success: false, error: "You already have this exam open — reload the page" }
    }
    console.error("Start exam error:", error)
    return { success: false, error: "Failed to start the exam" }
  }
}

export async function saveExamAnswers(
  attemptId: string,
  answers: Record<string, string[]>
): Promise<{ success: boolean; expired?: boolean }> {
  try {
    const user = await initAction()
    if (!user) return { success: false }

    const attempt = await ExamAttempt.findOne({ _id: attemptId, user: user.id })
    if (!attempt || attempt.status !== "in_progress") return { success: false }

    // 5s grace beyond the deadline for in-flight autosaves.
    if (attempt.deadlineAt.getTime() + 5_000 < Date.now()) {
      await gradeAttempt(attempt)
      return { success: false, expired: true }
    }

    const valid = new Set(attempt.questionOrder.map((q) => q.toString()))
    const merged = new Map(attempt.answers.map((a) => [a.question.toString(), a.optionIds]))
    for (const [qid, optionIds] of Object.entries(answers)) {
      if (valid.has(qid) && Array.isArray(optionIds)) {
        merged.set(qid, optionIds.slice(0, 8))
      }
    }
    attempt.answers = [...merged.entries()].map(([qid, optionIds]) => ({
      question: new Types.ObjectId(qid),
      optionIds,
    })) as typeof attempt.answers
    await attempt.save()

    return { success: true }
  } catch (error) {
    console.error("Save answers error:", error)
    return { success: false }
  }
}

export type ExamResult = {
  status: AttemptStatus
  passed: boolean
  scorePercent: number
  pointsEarned: number
  pointsTotal: number
  passMarkPercent: number
  attemptsLeft: number | null
  courseCompleted: boolean
}

export async function submitExamAttempt(
  attemptId: string,
  answers?: Record<string, string[]>
): Promise<{ success: true; result: ExamResult } | { success: false; error: string }> {
  try {
    const user = await initAction()
    if (!user) return { success: false, error: "Not authenticated" }

    const attempt = await ExamAttempt.findOne({ _id: attemptId, user: user.id })
    if (!attempt) return { success: false, error: "Attempt not found" }

    const exam = await Exam.findById(attempt.exam).select("settings title course scope")
    if (!exam) return { success: false, error: "Exam not found" }

    if (attempt.status === "in_progress") {
      // Fold in any final answers that raced the submit click.
      if (answers) {
        const valid = new Set(attempt.questionOrder.map((q) => q.toString()))
        const merged = new Map(attempt.answers.map((a) => [a.question.toString(), a.optionIds]))
        for (const [qid, optionIds] of Object.entries(answers)) {
          if (valid.has(qid) && Array.isArray(optionIds)) merged.set(qid, optionIds.slice(0, 8))
        }
        attempt.answers = [...merged.entries()].map(([qid, optionIds]) => ({
          question: new Types.ObjectId(qid),
          optionIds,
        })) as typeof attempt.answers
      }
      const graded = await gradeAttempt(attempt)

      const finished = await ExamAttempt.countDocuments({
        user: user.id,
        exam: attempt.exam,
        status: { $ne: "in_progress" },
      })
      const max = exam.settings.maxAttempts
      const enrollment = await Enrollment.findById(attempt.enrollment).select("status").lean()

      if (graded.passed) {
        const isFinal = (exam.scope ?? "final") === "final"
        void notifyUser(user.id, {
          type: "course",
          title: `You passed ${exam.title} 🎉`,
          body: isFinal
            ? `Score: ${graded.scorePercent}% — your certificate is unlocked.`
            : `Knowledge check score: ${graded.scorePercent}%. Keep going!`,
          href: isFinal
            ? `/dashboard/courses/${exam.course.toString()}/certificate`
            : `/dashboard/courses/${exam.course.toString()}`,
        })
      }

      revalidatePath(`/dashboard/courses/${exam.course.toString()}`)
      revalidatePath("/dashboard/certificates")

      return {
        success: true,
        result: {
          status: attempt.status,
          passed: graded.passed,
          scorePercent: graded.scorePercent,
          pointsEarned: graded.pointsEarned,
          pointsTotal: graded.pointsTotal,
          passMarkPercent: exam.settings.passMarkPercent,
          attemptsLeft: max === 0 ? null : Math.max(0, max - finished),
          courseCompleted: enrollment?.status === "completed",
        },
      }
    }

    // Already terminal — return the recorded result (idempotent submit).
    const finished = await ExamAttempt.countDocuments({
      user: user.id,
      exam: attempt.exam,
      status: { $ne: "in_progress" },
    })
    const max = exam.settings.maxAttempts
    const enrollment = await Enrollment.findById(attempt.enrollment).select("status").lean()
    return {
      success: true,
      result: {
        status: attempt.status,
        passed: attempt.status === "passed",
        scorePercent: attempt.scorePercent ?? 0,
        pointsEarned: attempt.pointsEarned ?? 0,
        pointsTotal: attempt.pointsTotal ?? 0,
        passMarkPercent: exam.settings.passMarkPercent,
        attemptsLeft: max === 0 ? null : Math.max(0, max - finished),
        courseCompleted: enrollment?.status === "completed",
      },
    }
  } catch (error) {
    console.error("Submit exam error:", error)
    return { success: false, error: "Failed to submit — your answers are saved, try again" }
  }
}

/* ═══════════════════ admin oversight ═══════════════════ */

export type AdminExamRow = {
  id: string
  title: string
  scope: "final" | "lesson"
  courseTitle: string
  courseId: string
  instructorName: string
  status: string
  required: boolean
  questionCount: number
  attemptCount: number
  passCount: number
}

export async function adminListExams(): Promise<AdminExamRow[]> {
  try {
    const { requireAdmin } = await import("@/lib/auth/admin")
    await connectDB()
    await requireAdmin()

    const exams = await Exam.find({})
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate("course", "title examRequired")
      .populate("instructor", "firstName lastName")
      .lean()

    const counts = await ExamAttempt.aggregate([
      { $match: { status: { $ne: "in_progress" } } },
      {
        $group: {
          _id: "$exam",
          attempts: { $sum: 1 },
          passes: { $sum: { $cond: [{ $eq: ["$status", "passed"] }, 1, 0] } },
        },
      },
    ])
    const countMap = new Map(counts.map((c) => [c._id.toString(), c]))

    return exams.map((e) => {
      const course = e.course as unknown as { _id?: Types.ObjectId; title?: string; examRequired?: boolean } | null
      const instructor = e.instructor as unknown as { firstName?: string; lastName?: string } | null
      const c = countMap.get(e._id.toString())
      return {
        id: e._id.toString(),
        title: e.title,
        scope: (e.scope ?? "final") as "final" | "lesson",
        courseTitle: course?.title ?? "Course",
        courseId: course?._id?.toString() ?? "",
        instructorName: instructor
          ? `${instructor.firstName ?? ""} ${instructor.lastName ?? ""}`.trim() || "Unknown"
          : "Unknown",
        status: e.status,
        required: !!course?.examRequired,
        questionCount: e.questionCount,
        attemptCount: c?.attempts ?? 0,
        passCount: c?.passes ?? 0,
      }
    })
  } catch (error) {
    console.error("Admin list exams error:", error)
    return []
  }
}

/** Wipe a student's finished attempts for one exam so they can retake it. */
export async function adminResetExamAttempts(examId: string, userEmail: string) {
  try {
    const { requireAdmin } = await import("@/lib/auth/admin")
    await connectDB()
    await requireAdmin()

    const { User } = await import("@/lib/db/models")
    const student = await User.findOne({ email: userEmail.toLowerCase().trim() }).select("_id")
    if (!student) return { success: false, error: "No user with that email" }

    const res = await ExamAttempt.deleteMany({
      exam: examId,
      user: student._id,
      status: { $in: ["failed", "expired", "submitted"] },
    })
    return { success: true, removed: res.deletedCount ?? 0 }
  } catch (error) {
    console.error("Reset attempts error:", error)
    return { success: false, error: "Failed to reset attempts" }
  }
}
