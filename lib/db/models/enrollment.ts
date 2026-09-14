import mongoose, { Schema, Document, Model, Types } from "mongoose"
import type { PackageKey } from "./course"

/**
 * pre_enrolled — enrolled before the course's availableAt, uncharged. Becomes
 * active via activation (free course going live, or payment success on a paid
 * one). "Payment required" is NOT a stored status: it is a pre_enrolled
 * enrollment whose course is live and paid — derived at read time.
 * suspended/cancelled — admin actions on one customer's enrollment; restore
 * returns to pre_enrolled or active depending on activatedAt.
 */
export type EnrollmentStatus =
  | "pre_enrolled"
  | "active"
  | "completed"
  | "expired"
  | "refunded"
  | "suspended"
  | "cancelled"

export interface IEnrollment extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  course: Types.ObjectId
  status: EnrollmentStatus
  // Purchase info
  purchasedAt: Date
  pricePaid: number
  currency: string
  transactionId: string | null
  /** Set when the user pre-enrolled on a scheduled course (no charge). */
  preEnrolledAt: Date | null
  /** When access was actually granted — payment success, or free-course start. */
  activatedAt: Date | null
  /** True for pre-payment-integration paid enrollments granted without a real charge (grandfathered, excluded from earnings). */
  legacyUnpaid: boolean
  /** Package bought (null = legacy single-price, free, or pre-enrolled). */
  packageKey: PackageKey | null
  /** Package name snapshot at purchase. */
  packageName: string | null
  /** Executive onboarding answers, sent once from the checkout success page (D4). */
  mentorshipIntake: { goals: string; availability: string; submittedAt: Date } | null
  /**
   * Stable certificate ID (spec §13), e.g. "WSA-7K2M9QXD". Stamped once, when a
   * completion's package includes the certificate (lib/certificate-id.ts);
   * null for Basic completions and for rows that aren't complete.
   */
  certificateId: string | null
  // Progress tracking
  progress: number // 0-100 percentage
  completedLessons: Types.ObjectId[] // Array of completed lesson IDs
  lastAccessedLesson: Types.ObjectId | null
  lastAccessedAt: Date | null
  completedAt: Date | null
  // CBT exam gate (additive — Go ignores unmapped fields until it opts in)
  examPassed: boolean
  examPassedAt: Date | null
  bestScorePercent: number | null
  createdAt: Date
  updatedAt: Date
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pre_enrolled", "active", "completed", "expired", "refunded", "suspended", "cancelled"],
      default: "active",
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
    pricePaid: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    transactionId: {
      type: String,
      default: null,
    },
    preEnrolledAt: {
      type: Date,
      default: null,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    legacyUnpaid: {
      type: Boolean,
      default: false,
    },
    packageKey: { type: String, enum: [null, "basic", "standard", "executive"], default: null },
    packageName: { type: String, default: null },
    mentorshipIntake: {
      type: new Schema(
        {
          goals: { type: String, required: true, maxlength: 2000 },
          availability: { type: String, required: true, maxlength: 500 },
          submittedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    certificateId: { type: String, default: null },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completedLessons: [
      {
        type: Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],
    lastAccessedLesson: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      default: null,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    examPassed: {
      type: Boolean,
      default: false,
    },
    examPassedAt: {
      type: Date,
      default: null,
    },
    bestScorePercent: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Compound unique index - a user can only enroll once per course
EnrollmentSchema.index({ user: 1, course: 1 }, { unique: true })

// Index for finding user's enrollments
EnrollmentSchema.index({ user: 1, status: 1 })

// Index for course analytics
EnrollmentSchema.index({ course: 1, status: 1 })

// Certificate IDs are unique among the enrollments that hold one. A partial
// filter, NOT `sparse`: Mongoose stores certificateId: null on every new row,
// and a sparse index still indexes explicit nulls — the second null would be a
// duplicate-key error on every enrollment create.
EnrollmentSchema.index(
  { certificateId: 1 },
  { unique: true, partialFilterExpression: { certificateId: { $type: "string" } } }
)

export const Enrollment: Model<IEnrollment> =
  mongoose.models.Enrollment || mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema)
