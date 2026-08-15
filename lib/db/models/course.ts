import mongoose, { Schema, Document, Model, Types } from "mongoose"

export type CourseLevel = "beginner" | "intermediate" | "advanced"
export type CoursePricing = "free" | "paid"
/**
 * Stored lifecycle only. "Coming soon" vs "live" is NEVER stored — it is
 * derived from status + availableAt at read time (courseAvailability in
 * lib/types/course.ts), so the flip at the availability instant needs no cron.
 *  - suspended: temporarily offline by admin; enrolled users keep records but
 *    nobody can start or newly activate.
 *  - closed: no new enrollments; existing enrollments keep access.
 */
export type CourseStatus = "draft" | "published" | "suspended" | "closed" | "archived"

export interface ICourse extends Document {
  _id: Types.ObjectId
  title: string
  slug: string
  description: string
  shortDescription: string | null
  thumbnailUrl: string | null
  thumbnailPublicId: string | null
  previewVideoUrl: string | null
  instructor: Types.ObjectId
  level: CourseLevel
  pricing: CoursePricing
  price: number
  currency: string
  status: CourseStatus
  category: string
  tags: string[]
  // Computed/cached values (updated via hooks)
  totalLessons: number
  totalDuration: number // in minutes
  enrolledCount: number
  // Rating aggregates
  rating: {
    average: number
    count: number
    distribution: {
      1: number
      2: number
      3: number
      4: number
      5: number
    }
  }
  // SEO & Marketing
  whatYouWillLearn: string[]
  requirements: string[]
  targetAudience: string[]
  // Timestamps
  publishedAt: Date | null
  /**
   * When a published course becomes startable. null = live the moment it is
   * published. Future date = customers see "Coming Soon" + countdown, and may
   * pre-enroll (free, uncharged) while preEnrollEnabled.
   */
  availableAt: Date | null
  /** Admin gate for pre-launch enrollment on scheduled courses. */
  preEnrollEnabled: boolean
  /** Stamped by the course-live cron after went-live emails go out — the guard
   *  that makes that batch idempotent. */
  liveNotifiedAt: Date | null
  /** When true, passing the course exam gates completion + certificate (enforced web + Go). */
  examRequired: boolean
  createdAt: Date
  updatedAt: Date
}

const CourseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      default: null,
      maxlength: 200,
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    thumbnailPublicId: {
      type: String,
      default: null,
    },
    previewVideoUrl: {
      type: String,
      default: null,
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    pricing: {
      type: String,
      enum: ["free", "paid"],
      default: "free",
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["draft", "published", "suspended", "closed", "archived"],
      default: "draft",
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    tags: [{ type: String }],
    totalLessons: {
      type: Number,
      default: 0,
    },
    totalDuration: {
      type: Number,
      default: 0,
    },
    enrolledCount: {
      type: Number,
      default: 0,
    },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
      distribution: {
        1: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        5: { type: Number, default: 0 },
      },
    },
    whatYouWillLearn: [{ type: String }],
    requirements: [{ type: String }],
    targetAudience: [{ type: String }],
    examRequired: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    availableAt: {
      type: Date,
      default: null,
      index: true,
    },
    preEnrollEnabled: {
      type: Boolean,
      default: true,
    },
    liveNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for common queries
CourseSchema.index({ title: "text", description: "text", tags: "text" })
CourseSchema.index({ status: 1, pricing: 1, level: 1 })
CourseSchema.index({ instructor: 1, status: 1 })
CourseSchema.index({ "rating.average": -1 })
CourseSchema.index({ enrolledCount: -1 })

// Generate slug from title before saving
CourseSchema.pre("save", function () {
  if (this.isModified("title") && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      + "-" + Date.now().toString(36)
  }
})

export const Course: Model<ICourse> =
  mongoose.models.Course || mongoose.model<ICourse>("Course", CourseSchema)
