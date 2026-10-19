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

/**
 * What kind of course this is (owner meeting 2026-10-03). Legacy rows have no
 * field and read as "program" — always go through `courseKindOf`
 * (lib/course-kind.ts).
 *  - program      a school program: live cohorts, Basic/Standard/Executive
 *  - marketplace  a pre-recorded course sold on the Academy marketplace, by an
 *                 approved seller or by the Academy's own faculty
 *  - new-economy  a free course on how to use a WorldStreet product
 */
export type CourseKind = "program" | "marketplace" | "new-economy"

/** A marketplace course's quality review before it may be published (approved sellers only). */
export type CourseReviewStatus = "none" | "pending" | "approved" | "changes_requested"


/**
 * What a package unlocks beyond the lessons themselves (spec §6 ladder).
 * `recordings` (institutional blueprint §9, 2026-10-19): recorded classes; read it
 * through `recordingsAllowed`, since plans saved before it carry only `liveClasses`.
 */
export interface IPackageEntitlements {
  liveClasses: boolean
  instructorQa: boolean
  assignments: boolean
  certificate: boolean
  mentorship: boolean
  prioritySupport: boolean
  recordings: boolean
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
  /**
   * The price before the launch discount, whole USD. Display only: shown
   * struck through beside `price` when it is higher. Checkout always charges
   * `price`. null = no discount to show.
   */
  listPrice: number | null
  /** How long the package runs, as copy ("9 weeks"). null = not stated. */
  duration: string | null
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
  /** See CourseKind; missing on legacy rows (= "program"). */
  kind: CourseKind
  /** Marketplace quality review. Status stays "draft" until an admin approves. */
  review: {
    status: CourseReviewStatus
    submittedAt: Date | null
    reviewedAt: Date | null
    reviewedBy: Types.ObjectId | null
    note: string | null
  }
  /** The class community for this course (WhatsApp, Telegram, Discord, Social…); null = none. */
  communityUrl: string | null
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
            listPrice: { type: Number, default: null, min: 0 },
            duration: { type: String, default: null, trim: true, maxlength: 40 },
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
              recordings: { type: Boolean, default: false },
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    kind: {
      type: String,
      enum: ["program", "marketplace", "new-economy"],
      default: "program",
      index: true,
    },
    review: {
      status: { type: String, enum: ["none", "pending", "approved", "changes_requested"], default: "none" },
      submittedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      note: { type: String, default: null, maxlength: 2000 },
    },
    communityUrl: { type: String, default: null, trim: true, maxlength: 500 },
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
