import mongoose, { Schema, Document, Types } from "mongoose"

export type MeetingStatus = "scheduled" | "waiting" | "active" | "ended"

export interface IMeetingParticipant {
  userId: Types.ObjectId
  role: "host" | "co-host" | "participant" | "guest"
  joinedAt?: Date
  leftAt?: Date
  status: "pending" | "admitted" | "declined" | "left" | "kicked"
}

export interface IMeetingInvite {
  userId: Types.ObjectId
  email: string
  status: "pending" | "sent" | "joined"
  sentAt?: Date
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
  /** If created from a course, links to course for thumbnail/notifications */
  courseId?: Types.ObjectId
  courseThumbnailUrl?: string
  /** Email invites sent for this meeting */
  invites: IMeetingInvite[]
  settings: {
    allowScreenShare: boolean
    muteOnEntry: boolean
    requireApproval: boolean
    guestAccess: boolean
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
    role: { type: String, enum: ["host", "co-host", "participant", "guest"], default: "participant" },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    status: { type: String, enum: ["pending", "admitted", "declined", "left", "kicked"], default: "pending" },
  },
  { _id: false }
)

const MeetingInviteSchema = new Schema<IMeetingInvite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    email: { type: String, required: true },
    status: { type: String, enum: ["pending", "sent", "joined"], default: "pending" },
    sentAt: { type: Date },
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
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    courseThumbnailUrl: { type: String },
    invites: [MeetingInviteSchema],
    settings: {
      allowScreenShare: { type: Boolean, default: true },
      muteOnEntry: { type: Boolean, default: true },
      requireApproval: { type: Boolean, default: true },
      guestAccess: { type: Boolean, default: true },
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

// In development, delete cached model to pick up schema changes
if (process.env.NODE_ENV === "development" && mongoose.models.Meeting) {
  delete mongoose.models.Meeting
}

export const Meeting =
  (mongoose.models.Meeting as mongoose.Model<IMeeting>) ||
  mongoose.model<IMeeting>("Meeting", MeetingSchema)
