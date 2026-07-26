import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * One student sitting of an exam. The server is authoritative for time:
 * `deadlineAt = startedAt + durationMinutes` is stamped at start; saves and
 * submissions after the deadline auto-expire and grade whatever was saved.
 *
 * The shuffled question/option order is SNAPSHOTTED here at start so a
 * resume (tab close, refresh) shows the exact same paper.
 */

export type AttemptStatus = "in_progress" | "submitted" | "expired" | "passed" | "failed"

export interface IAttemptAnswer {
  question: Types.ObjectId
  optionIds: string[]
}

export interface IExamAttempt extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  exam: Types.ObjectId
  course: Types.ObjectId
  enrollment: Types.ObjectId
  attemptNumber: number
  status: AttemptStatus
  startedAt: Date
  deadlineAt: Date
  submittedAt: Date | null
  answers: IAttemptAnswer[]
  /** Snapshot of shuffled question ids (paper order). */
  questionOrder: Types.ObjectId[]
  /** Snapshot of shuffled option ids per question id. */
  optionOrder: Record<string, string[]>
  scorePercent: number | null
  pointsEarned: number | null
  pointsTotal: number | null
  createdAt: Date
  updatedAt: Date
}

const ExamAttemptSchema = new Schema<IExamAttempt>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["in_progress", "submitted", "expired", "passed", "failed"],
      default: "in_progress",
      index: true,
    },
    startedAt: { type: Date, required: true },
    deadlineAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    answers: [
      {
        question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
        optionIds: [{ type: String }],
        _id: false,
      },
    ],
    questionOrder: [{ type: Schema.Types.ObjectId, ref: "Question" }],
    optionOrder: { type: Schema.Types.Mixed, default: {} },
    scorePercent: { type: Number, default: null },
    pointsEarned: { type: Number, default: null },
    pointsTotal: { type: Number, default: null },
  },
  { timestamps: true }
)

// One live sitting per user+exam; finished attempts accumulate as history.
ExamAttemptSchema.index(
  { user: 1, exam: 1 },
  { unique: true, partialFilterExpression: { status: "in_progress" } }
)
ExamAttemptSchema.index({ exam: 1, createdAt: -1 })

export const ExamAttempt: Model<IExamAttempt> =
  mongoose.models.ExamAttempt || mongoose.model<IExamAttempt>("ExamAttempt", ExamAttemptSchema)
