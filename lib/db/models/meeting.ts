import mongoose, { Schema, Document, Types } from "mongoose"

export type MeetingStatus = "scheduled" | "waiting" | "active" | "ended"

export interface IMeetingParticipant {
  userId: Types.ObjectId
  role: "host" | "co-host" | "participant"
  joinedAt?: Date
  leftAt?: Date
  status: "pending" | "admitted" | "declined" | "left"
}

export interface IMeeting extends Document {
  _id: Types.ObjectId
  title: string
  description?: string
  hostId: Types.ObjectId
  status: MeetingStatus
  meetingId: string // Dyte/RTK meeting ID
  hostToken: string // Host's RTK auth token
  participants: IMeetingParticipant[]
  settings: {
    allowScreenShare: boolean
    muteOnEntry: boolean
    requireApproval: boolean
    maxParticipants: number
  }
  scheduledAt?: Date
  startedAt?: Date
  endedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const MeetingParticipantSchema = new Schema<IMeetingParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["host", "co-host", "participant"], default: "participant" },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    status: { type: String, enum: ["pending", "admitted", "declined", "left"], default: "pending" },
  },
  { _id: false }
)

const MeetingSchema = new Schema<IMeeting>(
  {
    title: { type: String, required: true },
    description: { type: String },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["scheduled", "waiting", "active", "ended"], default: "waiting" },
    meetingId: { type: String, required: true },
    hostToken: { type: String, required: true },
    participants: [MeetingParticipantSchema],
    settings: {
      allowScreenShare: { type: Boolean, default: true },
      muteOnEntry: { type: Boolean, default: true },
      requireApproval: { type: Boolean, default: true },
      maxParticipants: { type: Number, default: 50 },
    },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true }
)

MeetingSchema.index({ hostId: 1, status: 1 })
MeetingSchema.index({ status: 1, createdAt: -1 })

export const Meeting =
  (mongoose.models.Meeting as mongoose.Model<IMeeting>) ||
  mongoose.model<IMeeting>("Meeting", MeetingSchema)
