import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * An academic session (Phase 12, D20). Admins enter these at /admin/cohorts;
 * every countdown, banner and offer timer follows the next one. A learner's
 * cohort is derived from the enrolment date, never stored on `Enrollment`.
 * `name` is stored for readability but views derive it from `number`.
 * Web-only collection: invisible to the Go API.
 */
export interface ICohort extends Document {
  _id: Types.ObjectId
  number: number
  name: string
  startsAt: Date
  endsAt: Date | null
  /** Admin-only; never printed on a public page. */
  note: string | null
  createdBy: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const CohortSchema = new Schema<ICohort>(
  {
    number: { type: Number, required: true, min: 1, max: 999 },
    name: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    note: { type: String, default: null, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

CohortSchema.index({ number: 1 }, { unique: true })
CohortSchema.index({ startsAt: 1 })

export const Cohort: Model<ICohort> =
  mongoose.models.Cohort || mongoose.model<ICohort>("Cohort", CohortSchema)
