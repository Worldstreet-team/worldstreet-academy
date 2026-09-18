import mongoose, { Schema, Document, Model, Types } from "mongoose"
import type { PackageKey } from "./course"

/**
 * "The school I picked" (Phase 9). One row per user — the newest choice wins.
 * `course` and `packageKey` fill in as the learner gets further; a school with
 * no programs yet saves with both null. The intent is `converted` lazily, when
 * a reader sees the matching enrollment, so the money path never writes here.
 * New collection: invisible to the Go API.
 */
export type EnrollmentIntentStatus = "open" | "converted" | "dismissed"
export type EnrollmentIntentSource = "landing" | "start" | "checkout"

export interface IEnrollmentIntent extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  /** A SchoolSlug (lib/schools.ts); validated by Zod in the action. */
  school: string
  course: Types.ObjectId | null
  packageKey: PackageKey | null
  source: EnrollmentIntentSource
  status: EnrollmentIntentStatus
  /** When this school/program was chosen; reset when either changes. */
  savedAt: Date
  /** Pay-later email ledger (cron/reminders). */
  nudges: { h24SentAt: Date | null; h72SentAt: Date | null }
  createdAt: Date
  updatedAt: Date
}

const EnrollmentIntentSchema = new Schema<IEnrollmentIntent>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    school: { type: String, required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    packageKey: { type: String, enum: ["basic", "standard", "executive", null], default: null },
    source: { type: String, enum: ["landing", "start", "checkout"], required: true },
    status: { type: String, enum: ["open", "converted", "dismissed"], default: "open" },
    savedAt: { type: Date, default: () => new Date() },
    nudges: {
      h24SentAt: { type: Date, default: null },
      h72SentAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
)

// One intent per user.
EnrollmentIntentSchema.index({ user: 1 }, { unique: true })
// The nudge sweep: open intents, oldest first.
EnrollmentIntentSchema.index({ status: 1, savedAt: 1 })

export const EnrollmentIntent: Model<IEnrollmentIntent> =
  mongoose.models.EnrollmentIntent ||
  mongoose.model<IEnrollmentIntent>("EnrollmentIntent", EnrollmentIntentSchema)
