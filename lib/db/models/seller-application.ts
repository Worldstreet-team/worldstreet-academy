import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * Seller application — the door to the Academy Marketplace (owner,
 * 2026-10-05: approved sellers only). A person applies, an admin approves,
 * and only then may they create marketplace courses. Sellers are not faculty:
 * approval sets `User.sellerStatus = "approved"` and never touches `role`.
 *
 *   submitted → approved | rejected        (a rejected applicant may apply again)
 *
 * One SUBMITTED application per user (partial unique index); decided ones
 * stay as history. Web-only collection (`sellerapplications`) — the Go API
 * reads `users.sellerStatus`, not this.
 */

export type SellerApplicationStatus = "submitted" | "approved" | "rejected"

export interface ISellerApplication extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  status: SellerApplicationStatus
  /** The name they sell under (cards read "by <name>"). */
  fullName: string
  /** The school their course fits (lib/schools.ts slug). */
  school: string
  /** What they'll teach, in their words. */
  topic: string
  experience: string
  /** A sample of their teaching — a video, a channel, a course elsewhere (http/https). */
  sampleUrl: string
  /** Why learners should buy from them. */
  pitch: string
  /** When they agreed to the quality standards and the revenue split. */
  agreedAt: Date
  reviewedBy: Types.ObjectId | null
  reviewedAt: Date | null
  /** Why it was rejected — emailed to the applicant. */
  reason: string | null
  createdAt: Date
  updatedAt: Date
}

const SellerApplicationSchema = new Schema<ISellerApplication>(
  {
    // No field-level index — the partial unique index below covers {user: 1}.
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["submitted", "approved", "rejected"], default: "submitted", index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    school: { type: String, required: true },
    topic: { type: String, required: true, trim: true, maxlength: 160 },
    experience: { type: String, required: true, trim: true, maxlength: 2000 },
    sampleUrl: { type: String, required: true, trim: true, maxlength: 500 },
    pitch: { type: String, required: true, trim: true, maxlength: 2000 },
    agreedAt: { type: Date, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reason: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: true, collection: "sellerapplications" }
)

SellerApplicationSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { status: "submitted" }, name: "one_open_seller_application" }
)
SellerApplicationSchema.index({ status: 1, createdAt: -1 })
SellerApplicationSchema.index({ user: 1, createdAt: -1 })

export const SellerApplication: Model<ISellerApplication> =
  mongoose.models.SellerApplication ||
  mongoose.model<ISellerApplication>("SellerApplication", SellerApplicationSchema)
