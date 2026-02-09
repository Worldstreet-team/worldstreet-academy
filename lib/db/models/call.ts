import mongoose, { Schema, Document, Model, Types } from "mongoose"

export type CallStatus = "ringing" | "ongoing" | "completed" | "missed" | "declined" | "failed"
export type CallType = "video" | "audio"

export interface ICall extends Document {
  _id: Types.ObjectId
  conversationId: Types.ObjectId
  callerId: Types.ObjectId
  receiverId: Types.ObjectId
  type: CallType
  status: CallStatus
  /** Cloudflare RealtimeKit meeting ID */
  meetingId?: string
  /** Auth token for the caller to join */
  callerToken?: string
  /** Auth token for the receiver to join */
  receiverToken?: string
  /** When the call was answered */
  answeredAt?: Date
  /** When the call ended */
  endedAt?: Date
  /** Duration in seconds (set on end) */
  duration: number
  createdAt: Date
  updatedAt: Date
}

const CallSchema = new Schema<ICall>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    callerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["video", "audio"],
      required: true,
    },
    status: {
      type: String,
      enum: ["ringing", "ongoing", "completed", "missed", "declined", "failed"],
      default: "ringing",
    },
    meetingId: { type: String },
    callerToken: { type: String },
    receiverToken: { type: String },
    answeredAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Indexes
CallSchema.index({ callerId: 1, createdAt: -1 })
CallSchema.index({ receiverId: 1, status: 1 })
CallSchema.index({ status: 1 })

export const Call: Model<ICall> =
  mongoose.models.Call || mongoose.model<ICall>("Call", CallSchema)
