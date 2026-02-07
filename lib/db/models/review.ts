import mongoose, { Schema, Document, Model, Types } from "mongoose"

export interface IReview extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  course: Types.ObjectId
  rating: number // 1-5
  title: string | null
  content: string | null
  isVerifiedPurchase: boolean
  // Moderation
  isApproved: boolean
  isHidden: boolean
  // Helpfulness
  helpfulCount: number
  reportCount: number
  createdAt: Date
  updatedAt: Date
}

const ReviewSchema = new Schema<IReview>(
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      default: null,
      maxlength: 100,
    },
    content: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: true, // Auto-approve by default
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
)

// One review per user per course
ReviewSchema.index({ user: 1, course: 1 }, { unique: true })

// For fetching course reviews sorted by helpfulness/date
ReviewSchema.index({ course: 1, isApproved: 1, isHidden: 1, createdAt: -1 })

export const Review: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>("Review", ReviewSchema)
