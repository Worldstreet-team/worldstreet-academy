import mongoose, { Schema, Document, Model, Types } from "mongoose"

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

export const Enrollment: Model<IEnrollment> =
  mongoose.models.Enrollment || mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema)
