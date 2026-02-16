import mongoose, { Schema, Document, Model, Types } from "mongoose"

export interface IWatchProgress extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  course: Types.ObjectId
  lesson: Types.ObjectId
  /** Current playback position in seconds */
  currentTime: number
  /** Total duration of the video in seconds */
  duration: number
  /** Whether the user has watched the entire video */
  completed: boolean
  updatedAt: Date
  createdAt: Date
}

const WatchProgressSchema = new Schema<IWatchProgress>(
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
    },
    lesson: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },
    currentTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

// Compound unique index - one progress record per user per lesson
WatchProgressSchema.index({ user: 1, lesson: 1 }, { unique: true })

// Index for fetching all progress for a user's course
WatchProgressSchema.index({ user: 1, course: 1 })

export const WatchProgress: Model<IWatchProgress> =
  mongoose.models.WatchProgress ||
  mongoose.model<IWatchProgress>("WatchProgress", WatchProgressSchema)
