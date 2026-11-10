import mongoose, { Schema, Document, Model, Types } from "mongoose"
import type { PackageKey } from "./course"
import type { ManualPaymentMethod } from "./manual-payment"

/**
 * A learner who paid outside the platform (team voice note, 2026-11-06: the
 * first students paid before checkout took payments, and must not pay again).
 * An admin records the payment by email at /admin/enrollments/add. Access
 * opens at once when an account with that email exists, else on the
 * learner's first sign-in (lib/access-grants.ts). Opening writes the Order
 * (reference `academy_grant_<id>`, the method they paid by) and the
 * Enrollment, as a transfer approval does: no wallet charge, no instructor
 * Earning, no partner commission. New collection: invisible to the Go API.
 *
 * waiting — no account had this email when it was added; opens on sign-in.
 * opened — the enrollment exists (or the learner already had access).
 * cancelled — an admin withdrew it before it opened.
 */
export type AccessGrantStatus = "waiting" | "opened" | "cancelled"

export interface IAccessGrant extends Document {
  _id: Types.ObjectId
  /** Lowercased and trimmed — the address the learner signs in with. */
  email: string
  /** As the admin typed it, for the list before the learner has an account. */
  name: string | null
  course: Types.ObjectId
  /** Null only on a course that sells no packages. */
  packageKey: PackageKey | null
  packageName: string | null
  /** What they actually paid, in US cents (not today's price). */
  amountMinor: number
  method: ManualPaymentMethod
  /** Their payment's reference, as the admin has it. */
  reference: string | null
  note: string | null
  /** When they paid — the enrollment's purchasedAt, so their cohort is right. */
  paidAt: Date
  status: AccessGrantStatus
  user: Types.ObjectId | null
  enrollment: Types.ObjectId | null
  order: Types.ObjectId | null
  /** Opened onto an enrollment the learner already had: no new Order. */
  alreadyHadAccess: boolean
  addedBy: Types.ObjectId
  addedByName: string
  openedAt: Date | null
  /** Set while one request opens it, so two can't (cleared after; stale after 2 minutes). */
  openingAt: Date | null
  /** Why the last attempt to open it failed, for the admin list. */
  lastError: string | null
  /** The last "your place is ready" email to a learner without an account. */
  emailedAt: Date | null
  cancelledAt: Date | null
  cancelledByName: string | null
  createdAt: Date
  updatedAt: Date
}

const AccessGrantSchema = new Schema<IAccessGrant>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, default: null, maxlength: 120 },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    packageKey: { type: String, enum: [null, "basic", "standard", "executive"], default: null },
    packageName: { type: String, default: null },
    amountMinor: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ["espee", "bank", "usdt_trc20", "usdt_bep20"], required: true },
    reference: { type: String, default: null, maxlength: 120 },
    note: { type: String, default: null, maxlength: 500 },
    paidAt: { type: Date, required: true },
    status: { type: String, enum: ["waiting", "opened", "cancelled"], default: "waiting" },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", default: null },
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    alreadyHadAccess: { type: Boolean, default: false },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    addedByName: { type: String, required: true },
    openedAt: { type: Date, default: null },
    openingAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    emailedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledByName: { type: String, default: null },
  },
  { timestamps: true }
)

// Sign-in looks up a learner's waiting grants by email.
AccessGrantSchema.index({ email: 1, status: 1 })
// One waiting grant per learner and program.
AccessGrantSchema.index({ email: 1, course: 1 }, { unique: true, partialFilterExpression: { status: "waiting" } })
// The admin list, newest first.
AccessGrantSchema.index({ status: 1, createdAt: -1 })

export const AccessGrant: Model<IAccessGrant> =
  mongoose.models.AccessGrant || mongoose.model<IAccessGrant>("AccessGrant", AccessGrantSchema)
