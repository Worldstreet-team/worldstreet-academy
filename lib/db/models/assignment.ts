import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * A practical assignment on a course (spec §6 "Practical assignments", D7 v2).
 * Course-level in v1. Students see published ones only when their package
 * includes `assignments` (lib/actions/assignments.ts). New collection — the Go
 * API doesn't read it.
 */

export type AssignmentStatus = "draft" | "published"

export interface IAssignment extends Document {
  _id: Types.ObjectId
  course: Types.ObjectId
  /** The course instructor when created. */
  instructor: Types.ObjectId
  title: string
  /** Plain text (≤ 5,000). */
  instructions: string
  /** Shown to students; never enforced in v1. */
  dueAt: Date | null
  status: AssignmentStatus
  createdAt: Date
  updatedAt: Date
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    instructions: { type: String, default: "", maxlength: 5000 },
    dueAt: { type: Date, default: null },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
  },
  { timestamps: true }
)

AssignmentSchema.index({ course: 1, status: 1, createdAt: 1 })

export const Assignment: Model<IAssignment> =
  mongoose.models.Assignment || mongoose.model<IAssignment>("Assignment", AssignmentSchema)
