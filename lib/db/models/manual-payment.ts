import mongoose, { Schema, Document, Model, Types } from "mongoose"
import type { PackageKey } from "./course"

/**
 * A learner's proof of a payment made OUTSIDE the WorldStreet wallet — "Pay
 * with ESPEE" (owner meeting, 2026-10-03), and since 2026-11-05 a bank
 * transfer or USDT too (the programme document's payment details;
 * lib/payment-channels.ts). The learner sends the money to the Academy's
 * account, uploads the receipt and the transfer reference, and an admin
 * approves or rejects it. Approval writes the Order (paymentMethod = this
 * row's method) and the Enrollment; nothing here grants access by itself.
 *
 * State machine (history[] records every transition, Order-style):
 *   submitted → approved
 *             ↘ rejected   (the learner may submit a new proof)
 * An approval whose enrollment write fails is put back to `submitted`.
 *
 * The receipt lives ONLY in the private resources bucket, under the learner's
 * own folder (lib/r2.ts `paymentProofKeyPrefix`); this row stores the key,
 * never a URL. New collection, web-only — the Go API doesn't read it.
 */

export type ManualPaymentStatus = "submitted" | "approved" | "rejected"
export type ManualPaymentMethod = "espee" | "bank" | "usdt_trc20" | "usdt_bep20"

export interface IManualPaymentTransition {
  status: ManualPaymentStatus
  at: Date
  note?: string
  /** Display name of whoever made the change. */
  by?: string
}

export interface IManualPayment extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  authUserId: string
  course: Types.ObjectId
  packageKey: PackageKey | null
  /** Package name snapshot at submission. */
  packageName: string | null
  /** Integer US cents, derived on the server from the course at submission. */
  amountMinor: number
  currency: string
  method: ManualPaymentMethod
  /** What the learner was asked to send, e.g. "49 ESPEE", "49 USDT", "₦65,978 ($49)", or "$49 in naira" with no rate. */
  amountLabel: string
  /** A bank transfer's quote (2026-11-05): naira per $1, whose rate it was, and the whole naira asked for. Null otherwise, and on older rows. */
  ngnPerUsd: number | null
  rateSource: "pinned" | "market" | null
  amountNgn: number | null
  /** The partner code in the learner's `wsa_ref` cookie when they submitted — approval runs in the admin's request, so it is kept here. */
  referralCode: string | null
  /** The uploaded receipt's key; null when it went on WhatsApp instead (no private bucket — 2026-11-05). */
  receiptKey: string | null
  receiptContentType: string | null
  transferReference: string
  note: string
  status: ManualPaymentStatus
  reviewedBy: Types.ObjectId | null
  reviewedAt: Date | null
  rejectionReason: string | null
  order: Types.ObjectId | null
  enrollment: Types.ObjectId | null
  history: IManualPaymentTransition[]
  createdAt: Date
  updatedAt: Date
}

const ManualPaymentSchema = new Schema<IManualPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authUserId: { type: String, required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    packageKey: { type: String, enum: [null, "basic", "standard", "executive"], default: null },
    packageName: { type: String, default: null },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "USD" },
    method: { type: String, enum: ["espee", "bank", "usdt_trc20", "usdt_bep20"], default: "espee" },
    amountLabel: { type: String, required: true },
    ngnPerUsd: { type: Number, default: null },
    rateSource: { type: String, enum: [null, "pinned", "market"], default: null },
    amountNgn: { type: Number, default: null },
    referralCode: { type: String, default: null, maxlength: 24 },
    receiptKey: { type: String, default: null },
    receiptContentType: { type: String, default: null },
    transferReference: { type: String, required: true, maxlength: 120 },
    note: { type: String, default: "", maxlength: 500 },
    status: { type: String, enum: ["submitted", "approved", "rejected"], default: "submitted" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, maxlength: 500 },
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", default: null },
    history: [
      {
        status: { type: String, required: true },
        at: { type: Date, required: true },
        note: { type: String },
        by: { type: String },
        _id: false,
      },
    ],
  },
  { timestamps: true, collection: "manualpayments" }
)

// The admin queue: one status, newest first.
ManualPaymentSchema.index({ status: 1, createdAt: -1 })
// A learner's proofs for a program, newest first. createdAt is part of the key
// so this index's key pattern never collides with the partial unique one below.
ManualPaymentSchema.index({ user: 1, course: 1, createdAt: -1 })
// One open proof per learner per program. A partial filter: approved and
// rejected proofs are unlimited history, and a rejected learner may try again.
ManualPaymentSchema.index(
  { user: 1, course: 1 },
  { unique: true, partialFilterExpression: { status: "submitted" }, name: "user_1_course_1_open" }
)

export const ManualPayment: Model<IManualPayment> =
  mongoose.models.ManualPayment || mongoose.model<IManualPayment>("ManualPayment", ManualPaymentSchema)
