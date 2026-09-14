import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * A student's answer to one assignment: text and up to three files. Files live
 * ONLY in the private resources bucket; this row stores storage keys, never a
 * URL, and downloads are short-lived signed URLs minted after an ownership or
 * staff check (lib/actions/assignments.ts). One submission per student per
 * assignment, overwritten until graded. New collection — the Go API doesn't read it.
 */

export type SubmissionStatus = "submitted" | "graded"

export interface ISubmissionFile {
  /** R2 key under worldstreet-academy/submissions/<assignmentId>/<userId>/ in the private bucket. */
  key: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface ISubmission extends Document {
  _id: Types.ObjectId
  assignment: Types.ObjectId
  course: Types.ObjectId
  user: Types.ObjectId
  enrollment: Types.ObjectId
  text: string
  files: ISubmissionFile[]
  status: SubmissionStatus
  submittedAt: Date
  /** 0–100 once graded. */
  grade: number | null
  feedback: string
  gradedBy: Types.ObjectId | null
  gradedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    text: { type: String, default: "", maxlength: 10000 },
    files: [
      {
        key: { type: String, required: true },
        filename: { type: String, default: "" },
        mimeType: { type: String, default: "" },
        sizeBytes: { type: Number, default: 0 },
        _id: false,
      },
    ],
    status: { type: String, enum: ["submitted", "graded"], default: "submitted" },
    submittedAt: { type: Date, default: Date.now },
    grade: { type: Number, default: null, min: 0, max: 100 },
    feedback: { type: String, default: "", maxlength: 5000 },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

SubmissionSchema.index({ assignment: 1, user: 1 }, { unique: true })
SubmissionSchema.index({ user: 1, assignment: 1, status: 1 })

export const Submission: Model<ISubmission> =
  mongoose.models.Submission || mongoose.model<ISubmission>("Submission", SubmissionSchema)
