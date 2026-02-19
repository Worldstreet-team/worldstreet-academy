import mongoose, { Schema, Document, Model, Types } from "mongoose"

export interface IUser extends Document {
  _id: Types.ObjectId
  authUserId: string // Reference to central auth service userId
  email: string
  username: string
  firstName: string
  lastName: string
  bio: string | null
  avatarUrl: string | null
  signatureUrl: string | null
  role: "USER" | "INSTRUCTOR" | "ADMIN"
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

// Virtual for full name
UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Ensure virtuals are included in JSON
UserSchema.set("toJSON", { virtuals: true })
UserSchema.set("toObject", { virtuals: true })

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema)
