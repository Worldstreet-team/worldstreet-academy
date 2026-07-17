import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * One row per signed download URL issued — the analytics the business needs to
 * see which materials actually get used, and the audit trail for a leaked file.
 * Recorded at URL-issue time (we can't observe the fetch itself).
 */

export interface IResourceDownload extends Document {
  _id: Types.ObjectId
  resource: Types.ObjectId
  course: Types.ObjectId
  user: Types.ObjectId
  createdAt: Date
}

const ResourceDownloadSchema = new Schema<IResourceDownload>(
  {
    resource: { type: Schema.Types.ObjectId, ref: "Resource", required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

ResourceDownloadSchema.index({ course: 1, createdAt: -1 })

export const ResourceDownload: Model<IResourceDownload> =
  mongoose.models.ResourceDownload ||
  mongoose.model<IResourceDownload>("ResourceDownload", ResourceDownloadSchema)
