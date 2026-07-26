import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * CBT exam — one per course (v1). Built by the course's instructor, taken by
 * students after finishing all lessons. When `Course.examRequired` is true,
 * passing this exam gates course completion and the certificate — enforced at
 * the data layer on BOTH backends (web server actions + the Go mobile API).
 */

export type ExamStatus = "draft" | "published"

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
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, unique: true },
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

export const Exam: Model<IExam> = mongoose.models.Exam || mongoose.model<IExam>("Exam", ExamSchema)
