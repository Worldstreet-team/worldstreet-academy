import mongoose, { Schema, Document, Model, Types } from "mongoose"
import type { PackageKey } from "./course"

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
export type EarningKind = "sale" | "adjustment" | "referral"

export const INSTRUCTOR_REVENUE_SHARE = 0.85 // 85% instructor / 15% platform
/**
 * Marketplace seller shares (owner, 2026-10-05): the seller keeps 85% when the
 * buyer came through the seller's own link, 50% when the Academy made the sale.
 */
export const MARKETPLACE_SHARE_OWN_LINK = 0.85
export const MARKETPLACE_SHARE_ACADEMY = 0.5
/**
 * Referral commission (owner, 2026-10-05): a share of EVERY paid purchase the
 * referred person makes, however they paid (client, 2026-11-05: wallet, or a
 * transfer once an admin confirms it), booked as a "referral" earning that
 * clears like a sale (`bookReferralCommission`, lib/referrals.ts). Never on a
 * self-referral. The share follows the
 * plan bought (programme document of 13 Sept, §2 and §4; Owen, 2026-11-05):
 * Basic 10%, Standard 12%, Executive 15% — $4.90, $23.88 and $149.85 at
 * $49 / $199 / $999. A course sold without plans (New Economy) earns the base
 * rate, REFERRAL_COMMISSION_RATE.
 */
export const REFERRAL_COMMISSION_RATE = 0.1
export const REFERRAL_RATE_BY_PLAN: Record<PackageKey, number> = { basic: 0.1, standard: 0.12, executive: 0.15 }

/** The referral share of a purchase of plan `packageKey` (null: a course without plans). */
export function referralRateFor(packageKey: PackageKey | null | undefined): number {
  return packageKey ? REFERRAL_RATE_BY_PLAN[packageKey] : REFERRAL_COMMISSION_RATE
}
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
    kind: { type: String, enum: ["sale", "adjustment", "referral"], default: "sale" },
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

// Lookup only — deliberately NOT unique. A course can legitimately be sold
// against the same enrollment row more than once (buy → refund → re-buy
// reactivates that row), so uniqueness lives on `creditReference`, which
// carries the purchase generation and is what actually makes clearing
// idempotent.
EarningSchema.index({ enrollment: 1, createdAt: -1 })
EarningSchema.index({ instructor: 1, status: 1, availableAt: 1 })

export const Earning: Model<IEarning> =
  mongoose.models.Earning || mongoose.model<IEarning>("Earning", EarningSchema)
