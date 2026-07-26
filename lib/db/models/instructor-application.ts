import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * Instructor application — the review pipeline between "student" and
 * "instructor". One ACTIVE application per user (enforced by a partial unique
 * index); rejected/withdrawn applications stay as history and the user may
 * re-apply.
 *
 * State machine (history[] records every transition, Order-style):
 *   submitted → under_review → interview_scheduled → approved | rejected
 *        ↘ withdrawn (by the applicant, any time before a decision)
 *
 * Approval is the ONLY in-app path that promotes users.role to INSTRUCTOR.
 * The denormalized mirror `User.instructorStatus` keeps gating cheap across
 * both backends (additive field — the Go API ignores it until it opts in).
 */

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "interview_scheduled"
  | "approved"
  | "rejected"
  | "withdrawn"

/** Statuses considered "in flight" — at most one of these per user. */
export const ACTIVE_APPLICATION_STATUSES: ApplicationStatus[] = [
  "submitted",
  "under_review",
  "interview_scheduled",
]

export interface IApplicationAnswers {
  headline: string
  expertise: string[]
  /** e.g. "<1" | "1-3" | "3-5" | "5+" years */
  experienceYears: string
  experience: string
  motivation: string
  portfolioUrl: string | null
  twitter: string | null
  linkedin: string | null
  website: string | null
  sampleVideoUrl: string | null
}

export interface IApplicationTransition {
  status: ApplicationStatus
  at: Date
  /** Display name of whoever caused the transition (applicant or reviewer). */
  by?: string
  note?: string
}

export interface IReviewerNote {
  by: Types.ObjectId
  byName: string
  note: string
  at: Date
}

export interface IInstructorApplication extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  status: ApplicationStatus
  answers: IApplicationAnswers
  /** Set in Phase 3 when an interview meeting is scheduled for this application. */
  interviewMeetingId: Types.ObjectId | null
  reviewerNotes: IReviewerNote[]
  decidedBy: Types.ObjectId | null
  decidedAt: Date | null
  decisionNote: string
  history: IApplicationTransition[]
  createdAt: Date
  updatedAt: Date
}

const InstructorApplicationSchema = new Schema<IInstructorApplication>(
  {
    // NOTE: no field-level index — the partial unique index below covers {user: 1}.
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["submitted", "under_review", "interview_scheduled", "approved", "rejected", "withdrawn"],
      default: "submitted",
      index: true,
    },
    answers: {
      headline: { type: String, required: true, maxlength: 120 },
      expertise: [{ type: String, maxlength: 40 }],
      experienceYears: { type: String, default: "" },
      experience: { type: String, required: true, maxlength: 2000 },
      motivation: { type: String, required: true, maxlength: 2000 },
      portfolioUrl: { type: String, default: null },
      twitter: { type: String, default: null },
      linkedin: { type: String, default: null },
      website: { type: String, default: null },
      sampleVideoUrl: { type: String, default: null },
    },
    interviewMeetingId: { type: Schema.Types.ObjectId, ref: "Meeting", default: null },
    reviewerNotes: [
      {
        by: { type: Schema.Types.ObjectId, ref: "User", required: true },
        byName: { type: String, required: true },
        note: { type: String, required: true, maxlength: 2000 },
        at: { type: Date, required: true },
      },
    ],
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: "" },
    history: [
      {
        status: { type: String, required: true },
        at: { type: Date, required: true },
        by: { type: String },
        note: { type: String },
      },
    ],
  },
  { timestamps: true }
)

// One in-flight application per user; closed ones (approved/rejected/withdrawn)
// are unlimited history.
InstructorApplicationSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["submitted", "under_review", "interview_scheduled"] } },
  }
)
InstructorApplicationSchema.index({ status: 1, createdAt: -1 })

export const InstructorApplication: Model<IInstructorApplication> =
  mongoose.models.InstructorApplication ||
  mongoose.model<IInstructorApplication>("InstructorApplication", InstructorApplicationSchema)
