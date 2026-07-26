import mongoose, { Schema, Document, Model, Types } from "mongoose"

export type InstructorStatus = "none" | "applied" | "interview" | "approved" | "rejected"

export interface IUser extends Document {
  _id: Types.ObjectId
  authUserId: string // Reference to central auth service userId
  /** Additional Clerk ids linked to this account (written by the Go mobile backend — declared here so web writes never drop it). */
  linkedAuthIds: string[]
  email: string
  username: string
  firstName: string
  lastName: string
  bio: string | null
  avatarUrl: string | null
  signatureUrl: string | null
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  /** Instructor application pipeline state — additive field, safe for the Go backend (unmapped bson is ignored there). */
  instructorStatus: InstructorStatus
  verified: boolean
  walletBalance: number
  hasOnboarded: boolean
  preferredLanguage: string | null
  // For instructors
  instructorProfile?: {
    headline: string | null
    expertise: string[]
    socialLinks: {
      twitter?: string
      linkedin?: string
      website?: string
    }
    totalStudents: number
    totalCourses: number
    totalEarnings: number
  }
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    authUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    linkedAuthIds: [{ type: String }],
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      default: "User",
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    signatureUrl: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["USER", "INSTRUCTOR", "ADMIN"],
      default: "USER",
    },
    instructorStatus: {
      type: String,
      enum: ["none", "applied", "interview", "approved", "rejected"],
      default: "none",
    },
    verified: {
      type: Boolean,
      default: false,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    hasOnboarded: {
      type: Boolean,
      default: false,
    },
    preferredLanguage: {
      type: String,
      default: null,
    },
    instructorProfile: {
      headline: { type: String, default: null },
      expertise: [{ type: String }],
      socialLinks: {
        twitter: String,
        linkedin: String,
        website: String,
      },
      totalStudents: { type: Number, default: 0 },
      totalCourses: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
)

// Alternate Clerk identities are resolved on every authenticated request
// (see lib/auth/sync.ts) — keep that lookup indexed. Sparse: most users have none.
UserSchema.index({ linkedAuthIds: 1 }, { sparse: true })

// Virtual for full name
UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Ensure virtuals are included in JSON
UserSchema.set("toJSON", { virtuals: true })
UserSchema.set("toObject", { virtuals: true })

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema)
