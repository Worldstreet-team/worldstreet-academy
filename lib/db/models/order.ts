import mongoose, { Schema, Document, Model, Types } from "mongoose"
import type { PackageKey } from "./course"

/**
 * A purchase order for a paid course — the auditable state machine around a
 * checkout. The Enrollment stays the access record; the Order records how the
 * money moved (or failed to move).
 *
 * State machine:
 *   pending → payment_requested → paid → enrolled
 *                     ↘ failed            ↘ refunded
 *   (cancelled = user abandoned before a charge was attempted)
 *
 * Only a confirmed charge from the central Worldstreet wallet service moves an
 * order to `paid`; course access is granted on `enrolled` and never before.
 * The one exception is an ESPEE order (paymentMethod "espee", owner meeting
 * 2026-10-03): the money moved outside the wallet, so an admin's approval of
 * the learner's proof (ManualPayment) is what moves it to `paid`, and it never
 * carries a chargeId.
 */

export type OrderStatus =
  | "pending"
  | "payment_requested"
  | "paid"
  | "enrolled"
  | "failed"
  | "cancelled"
  | "refunded"

/** How the money moved. Additive: orders written before ESPEE read as "wallet". */
export type OrderPaymentMethod = "wallet" | "espee"

/**
 * Who made the sale (owner, 2026-10-05), decided in lib/referrals.ts:
 *   seller_link  a marketplace course bought through its seller's own code
 *   referral     any other code, owned by someone other than the buyer
 * Null (or missing, on older orders) is an Academy sale with no code.
 */
export type OrderAttributionKind = "seller_link" | "referral"

export interface IOrderAttribution {
  /** The referral code, as stored on its owner. */
  code: string
  /** The code's owner. */
  userId: Types.ObjectId
  kind: OrderAttributionKind
}

export interface IOrderTransition {
  status: OrderStatus
  at: Date
  note?: string
}

export interface IOrder extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  authUserId: string
  course: Types.ObjectId
  /** Deterministic business reference — one per user+course, shared with the wallet Idempotency-Key. */
  reference: string
  amountMinor: number
  currency: string
  status: OrderStatus
  /** Wallet charge id once the debit is confirmed. */
  chargeId: string | null
  packageKey: PackageKey | null
  paymentMethod: OrderPaymentMethod
  /** Additive: null = an Academy sale with no code. */
  attribution: IOrderAttribution | null
  failureCode: string | null
  history: IOrderTransition[]
  createdAt: Date
  updatedAt: Date
}

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authUserId: { type: String, required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    reference: { type: String, required: true, unique: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: ["pending", "payment_requested", "paid", "enrolled", "failed", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    chargeId: { type: String, default: null },
    packageKey: { type: String, enum: [null, "basic", "standard", "executive"], default: null },
    paymentMethod: { type: String, enum: ["wallet", "espee"], default: "wallet" },
    attribution: {
      type: new Schema(
        {
          code: { type: String, required: true },
          userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          kind: { type: String, enum: ["seller_link", "referral"], required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    failureCode: { type: String, default: null },
    history: [
      {
        status: { type: String, required: true },
        at: { type: Date, required: true },
        note: { type: String },
      },
    ],
  },
  { timestamps: true }
)

OrderSchema.index({ user: 1, course: 1 })
OrderSchema.index({ status: 1, createdAt: -1 })

export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema)
