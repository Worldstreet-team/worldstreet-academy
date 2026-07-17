import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * A downloadable learning material (eBook, PDF, worksheet, template, slides)
 * or an external link, attached to a course and optionally to one lesson.
 *
 * Storage rule: hosted files record ONLY `storageKey` — never a public URL.
 * Downloads are minted as short-lived signed URLs after an enrollment check
 * (see lib/actions/resources.ts). `isFree` marks a preview handout that
 * anyone can download without enrolling (the resource equivalent of a free
 * preview lesson).
 *
 * Shared collection with the Go backend — keep field names in lockstep.
 */

export type ResourceKind = "pdf" | "ebook" | "worksheet" | "template" | "slides" | "link"

export interface IResource extends Document {
  _id: Types.ObjectId
  course: Types.ObjectId
  /** null = course-level resource (available across the whole course). */
  lesson: Types.ObjectId | null
  title: string
  description: string
  kind: ResourceKind
  /** R2 object key for hosted files; null for kind="link". */
  storageKey: string | null
  /** Destination for kind="link"; null for hosted files. */
  externalUrl: string | null
  filename: string
  mimeType: string
  sizeBytes: number
  order: number
  isFree: boolean
  downloadCount: number
  createdAt: Date
  updatedAt: Date
}

const ResourceSchema = new Schema<IResource>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    lesson: { type: Schema.Types.ObjectId, ref: "Lesson", default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    kind: {
      type: String,
      enum: ["pdf", "ebook", "worksheet", "template", "slides", "link"],
      default: "pdf",
    },
    storageKey: { type: String, default: null },
    externalUrl: { type: String, default: null },
    filename: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    sizeBytes: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    isFree: { type: Boolean, default: false },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

ResourceSchema.index({ course: 1, order: 1 })

export const Resource: Model<IResource> =
  mongoose.models.Resource || mongoose.model<IResource>("Resource", ResourceSchema)
