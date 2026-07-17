import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * Append-only log of every payment-related event (charge requested, confirmed,
 * failed, refunded, earnings credited…). Never updated or deleted — this is
 * the immutable trail used for reconciliation and dispute handling.
 */

export interface IPaymentEvent extends Document {
  _id: Types.ObjectId
  order: Types.ObjectId | null
  reference: string
  type: string
  payload: Record<string, unknown>
  createdAt: Date
}

const PaymentEventSchema = new Schema<IPaymentEvent>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    reference: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

PaymentEventSchema.index({ createdAt: -1 })

export const PaymentEvent: Model<IPaymentEvent> =
  mongoose.models.PaymentEvent || mongoose.model<IPaymentEvent>("PaymentEvent", PaymentEventSchema)
