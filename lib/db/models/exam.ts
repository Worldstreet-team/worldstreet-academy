import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * CBT exam — two flavors sharing one engine:
 *
 * - scope "final"  — one per course. Unlocks at 100% lesson progress; when
 *   `Course.examRequired` is true, passing gates completion + certificate
 *   (enforced at the data layer on BOTH backends — web + the Go mobile API).
 * - scope "lesson" — an in-course knowledge check attached to one lesson.
 *   Practice-only in v1: available to any enrolled student, never gates
 *   completion, and is invisible to the mobile backend (additive fields).
 */

export type ExamStatus = "draft" | "published"
export type ExamScope = "final" | "lesson"

export interface IExamSettings {
  durationMinutes: number
  /** 0–100. */
  passMarkPercent: number
  /** 0 = unlimited. */
  maxAttempts: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  /** Show per-question correctness on the results screen. */
  showResults: boolean
}

export interface IExam extends Document {
  _id: Types.ObjectId
  course: Types.ObjectId
  /** "lesson" = in-course knowledge check bound to `lesson`. */
  scope: ExamScope
  lesson: Types.ObjectId | null
  instructor: Types.ObjectId
  title: string
  instructions: string
  status: ExamStatus
  settings: IExamSettings
  /** Cached counters (maintained by the question CRUD actions). */
  questionCount: number
  totalPoints: number
  createdAt: Date
  updatedAt: Date
}

const ExamSchema = new Schema<IExam>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    scope: { type: String, enum: ["final", "lesson"], default: "final" },
    lesson: { type: Schema.Types.ObjectId, ref: "Lesson", default: null },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 150 },
    instructions: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    settings: {
      durationMinutes: { type: Number, default: 30, min: 5, max: 240 },
      passMarkPercent: { type: Number, default: 70, min: 1, max: 100 },
      maxAttempts: { type: Number, default: 3, min: 0, max: 20 },
      shuffleQuestions: { type: Boolean, default: true },
      shuffleOptions: { type: Boolean, default: true },
      showResults: { type: Boolean, default: true },
    },
    questionCount: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// One FINAL exam per course; one knowledge check per lesson. Named indexes so
// they never collide with the retired `course_1` unique index
// (scripts/migrate-exam-indexes.mjs drops that one).
ExamSchema.index(
  { course: 1 },
  { unique: true, partialFilterExpression: { scope: "final" }, name: "course_final_unique" }
)
ExamSchema.index(
  { lesson: 1 },
  { unique: true, partialFilterExpression: { scope: "lesson" }, name: "lesson_quiz_unique" }
)
ExamSchema.index({ course: 1, scope: 1 })

export const Exam: Model<IExam> = mongoose.models.Exam || mongoose.model<IExam>("Exam", ExamSchema)
