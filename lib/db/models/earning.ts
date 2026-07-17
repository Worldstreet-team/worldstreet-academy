import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * Instructor earnings ledger — one row per paid sale (kind "sale"), plus
 * negative "adjustment" rows for post-clearing refund clawbacks.
 *
 * Money flow: a sale's net share stays "pending" through the clearing window
 * (refund protection), then clears by crediting the instructor's central
 * Worldstreet wallet balance via the wallet service's /credits endpoint
 * (idempotent on `creditReference`). Withdrawal itself happens in the central
 * Worldstreet dashboard — the Academy never builds its own payout rail, and
 * KYC for payouts is enforced centrally at withdrawal time.
 */

export type EarningStatus = "pending" | "cleared" | "reversed"
export type EarningKind = "sale" | "adjustment"

export const INSTRUCTOR_REVENUE_SHARE = 0.85 // 85% instructor / 15% platform
export const EARNINGS_CLEARING_DAYS = 7

export interface IEarning extends Document {
  _id: Types.ObjectId
  enrollment: Types.ObjectId | null
  order: Types.ObjectId | null
  course: Types.ObjectId
  instructor: Types.ObjectId
  instructorAuthUserId: string
  student: Types.ObjectId | null
  kind: EarningKind
  grossMinor: number
  feeMinor: number
  /** Negative on adjustment rows. */
  netMinor: number
  currency: string
  status: EarningStatus
  availableAt: Date
  clearedAt: Date | null
  /** Deterministic wallet credit reference — makes clearing idempotent. */
  creditReference: string
  chargeId: string | null
  note: string
  createdAt: Date
  updatedAt: Date
}

const EarningSchema = new Schema<IEarning>(
  {
    enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", default: null },
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    instructorAuthUserId: { type: String, required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", default: null },
    kind: { type: String, enum: ["sale", "adjustment"], default: "sale" },
    grossMinor: { type: Number, required: true },
    feeMinor: { type: Number, required: true },
    netMinor: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["pending", "cleared", "reversed"], default: "pending", index: true },
    availableAt: { type: Date, required: true },
    clearedAt: { type: Date, default: null },
    creditReference: { type: String, required: true, unique: true },
    chargeId: { type: String, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true }
)

// One sale row per enrollment (adjustments use their own creditReference).
EarningSchema.index(
  { enrollment: 1 },
  { unique: true, partialFilterExpression: { kind: "sale", enrollment: { $type: "objectId" } } }
)
EarningSchema.index({ instructor: 1, status: 1, availableAt: 1 })

export const Earning: Model<IEarning> =
  mongoose.models.Earning || mongoose.model<IEarning>("Earning", EarningSchema)
