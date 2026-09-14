import mongoose, { Schema, Document, Model, Types } from "mongoose"
import type { SchoolSlug } from "@/lib/schools"

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

export type PackageKey = "basic" | "standard" | "executive"

/** What a package unlocks beyond the lessons themselves (spec §6 ladder). */
export interface IPackageEntitlements {
  liveClasses: boolean
  instructorQa: boolean
  assignments: boolean
  certificate: boolean
  mentorship: boolean
  prioritySupport: boolean
}

/**
 * One purchasable tier of a course. Prices are whole USD like Course.price.
 * An empty `packages` array means the course sells at its single `price`
 * (every course today) — readers synthesize one package from it.
 */
export interface ICoursePackage {
  key: PackageKey
  name: string
  tagline: string
  price: number
  features: string[]
  highlight: boolean
  ctaLabel: string | null
  enabled: boolean
  entitlements: IPackageEntitlements
}

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
  /** School this program belongs to (lib/schools.ts). null only on legacy rows not yet re-saved. */
  school: SchoolSlug | null
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
  packages: ICoursePackage[]
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
    school: {
      type: String,
      default: null,
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
    packages: {
      type: [
        new Schema<ICoursePackage>(
          {
            key: { type: String, enum: ["basic", "standard", "executive"], required: true },
            name: { type: String, required: true, trim: true, maxlength: 60 },
            tagline: { type: String, default: "", maxlength: 120 },
            price: { type: Number, required: true, min: 0 },
            features: { type: [String], default: [] },
            highlight: { type: Boolean, default: false },
            ctaLabel: { type: String, default: null, maxlength: 40 },
            enabled: { type: Boolean, default: true },
            entitlements: {
              liveClasses: { type: Boolean, default: false },
              instructorQa: { type: Boolean, default: false },
              assignments: { type: Boolean, default: false },
              certificate: { type: Boolean, default: false },
              mentorship: { type: Boolean, default: false },
              prioritySupport: { type: Boolean, default: false },
            },
          },
          { _id: false }
        ),
      ],
      default: [],
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
