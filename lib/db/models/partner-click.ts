import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * WMA Partners link clicks (institutional blueprint §15): one row per partner
 * code per Lagos day holding a counter, written by recordPartnerVisit
 * (lib/actions/partners.ts) with an upsert `$inc`. The rules live in
 * lib/partner-clicks.ts. `count` has no default so the upsert's `$inc` alone
 * sets it on insert. New collection, written only by the web — the Go API
 * never reads it.
 */
export interface IPartnerClick extends Document {
  _id: Types.ObjectId
  code: string
  /** Lagos calendar day, "YYYY-MM-DD". */
  day: string
  count: number
  createdAt: Date
  updatedAt: Date
}

const PartnerClickSchema = new Schema<IPartnerClick>(
  {
    code: { type: String, required: true, maxlength: 24 },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    count: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
)

PartnerClickSchema.index({ code: 1, day: 1 }, { unique: true })

export const PartnerClick: Model<IPartnerClick> =
  mongoose.models.PartnerClick || mongoose.model<IPartnerClick>("PartnerClick", PartnerClickSchema)
