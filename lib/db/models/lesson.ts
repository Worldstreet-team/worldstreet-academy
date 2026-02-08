import mongoose, { Schema, Document, Model, Types } from "mongoose"

export type LessonType = "video" | "live" | "text"

export interface ILesson extends Document {
  _id: Types.ObjectId
  course: Types.ObjectId
  title: string
  description: string | null
  type: LessonType
  // Video content
  videoUrl: string | null
  videoPublicId: string | null // Cloudinary public ID for management
  videoDuration: number | null // in seconds
  videoThumbnailUrl: string | null
  // Text content
  content: string | null
  // Live session
  liveScheduledAt: Date | null
  liveUrl: string | null
  // Ordering & access
  sectionTitle: string | null // Group lessons into sections
  order: number
  isFree: boolean // Preview lesson (accessible without purchase)
  isPublished: boolean
  // Resources
  resources: {
    title: string
    url: string
    type: "pdf" | "link" | "download"
  }[]
  createdAt: Date
  updatedAt: Date
}

const LessonSchema = new Schema<ILesson>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ["video", "live", "text"],
      default: "video",
    },
    videoUrl: {
      type: String,
      default: null,
    },
    videoPublicId: {
      type: String,
      default: null,
    },
    videoDuration: {
      type: Number,
      default: null,
    },
    videoThumbnailUrl: {
      type: String,
      default: null,
    },
    content: {
      type: String,
      default: null,
    },
    liveScheduledAt: {
      type: Date,
      default: null,
    },
    liveUrl: {
      type: String,
      default: null,
    },
    sectionTitle: {
      type: String,
      default: null,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    isFree: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    resources: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, enum: ["pdf", "link", "download"], default: "link" },
      },
    ],
  },
  {
    timestamps: true,
  }
)

// Compound index for ordering within a course
LessonSchema.index({ course: 1, order: 1 })

export const Lesson: Model<ILesson> =
  mongoose.models.Lesson || mongoose.model<ILesson>("Lesson", LessonSchema)
