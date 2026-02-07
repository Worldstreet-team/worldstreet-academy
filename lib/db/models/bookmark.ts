import mongoose, { Schema, Document, Model, Types } from "mongoose"

export interface IBookmark extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  course: Types.ObjectId
  createdAt: Date
}

const BookmarkSchema = new Schema<IBookmark>(
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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// One bookmark per user per course
BookmarkSchema.index({ user: 1, course: 1 }, { unique: true })

export const Bookmark: Model<IBookmark> =
  mongoose.models.Bookmark || mongoose.model<IBookmark>("Bookmark", BookmarkSchema)
