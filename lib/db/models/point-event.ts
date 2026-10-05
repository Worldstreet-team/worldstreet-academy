import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * Learning points (owner meeting, 2026-10-03): one row per award — a lesson
 * finished, an assignment handed in or graded, an exam passed, a program
 * completed. Points have no cash value. The amounts and award keys live in
 * lib/points.ts; nothing here caches a total — totals are summed on read.
 * `key` is unique, so writing the same award twice is a no-op (duplicate key).
 * New collection, written only by the web — the Go API doesn't read it.
 */
export type PointEventKind =
  | "lesson_completed"
  | "assignment_submitted"
  | "assignment_graded"
  | "exam_passed"
  | "course_completed"

export interface IPointEvent extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  course: Types.ObjectId | null
  kind: PointEventKind
  points: number
  /** Idempotency key, e.g. `lesson:<enrollmentId>:<lessonId>` (lib/points.ts). */
  key: string
  createdAt: Date
}

const PointEventSchema = new Schema<IPointEvent>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    kind: {
      type: String,
      enum: ["lesson_completed", "assignment_submitted", "assignment_graded", "exam_passed", "course_completed"],
      required: true,
    },
    points: { type: Number, required: true, min: 0 },
    key: { type: String, required: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

PointEventSchema.index({ key: 1 }, { unique: true })
// A student's total, this week and recent activity.
PointEventSchema.index({ user: 1, createdAt: -1 })
// A program's leaderboard.
PointEventSchema.index({ course: 1, user: 1 })

export const PointEvent: Model<IPointEvent> =
  mongoose.models.PointEvent || mongoose.model<IPointEvent>("PointEvent", PointEventSchema)
