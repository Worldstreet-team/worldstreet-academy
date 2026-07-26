import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * In-app notifications — the real data source behind the notification bell.
 * Rows are created by server actions (application status changes, refunds,
 * interview invites…) and delivered live via the Ably `notification:new`
 * event on the recipient's `user:<id>` channel.
 */

export type NotificationType =
  | "application" // instructor application lifecycle
  | "course" // course/lesson related
  | "payment" // orders, refunds, earnings
  | "meeting" // meeting/interview invites
  | "system"

export interface INotification extends Document {
  _id: Types.ObjectId
  user: Types.ObjectId
  type: NotificationType
  title: string
  body: string
  /** In-app destination, e.g. /dashboard/become-instructor */
  href: string | null
  readAt: Date | null
  meta: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["application", "course", "payment", "meeting", "system"],
      default: "system",
    },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 500 },
    href: { type: String, default: null },
    readAt: { type: Date, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

NotificationSchema.index({ user: 1, createdAt: -1 })
NotificationSchema.index({ user: 1, readAt: 1 })

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema)
