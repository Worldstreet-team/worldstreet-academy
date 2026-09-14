import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * One Executive mentorship session (spec §6 "Private 1-on-1 coaching"). The
 * student proposes up to three times; the course instructor confirms one,
 * which creates an interview-shaped scheduled Meeting — deliberately without
 * courseId, which would reach every live-class student — linked back through
 * Meeting.mentorshipSessionId.
 *
 *   requested → confirmed | declined (instructor) | cancelled (either party)
 *   confirmed → cancelled (either party, while the room is still unstarted)
 *
 * "Upcoming" vs "past" is derived at read time from the linked meeting and the
 * time; v1 stores no completed state. New collection — the Go API doesn't read it.
 */

export type MentorshipSessionStatus = "requested" | "confirmed" | "declined" | "cancelled"

export interface IMentorshipSession extends Document {
  _id: Types.ObjectId
  student: Types.ObjectId
  /** The course instructor when the request was made. */
  instructor: Types.ObjectId
  course: Types.ObjectId
  enrollment: Types.ObjectId
  status: MentorshipSessionStatus
  /** 1–3 times the student proposed. */
  proposedSlots: { at: Date }[]
  /** What the student wants to cover (≤ 1,000). */
  note: string
  /** The confirmed slot. */
  scheduledAt: Date | null
  /** The Meeting (_id) created on confirmation. */
  meetingId: Types.ObjectId | null
  /** Decline or cancellation note from whoever closed it. */
  responseNote: string
  cancelledBy: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const MentorshipSessionSchema = new Schema<IMentorshipSession>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    enrollment: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    status: {
      type: String,
      enum: ["requested", "confirmed", "declined", "cancelled"],
      default: "requested",
    },
    proposedSlots: [
      {
        at: { type: Date, required: true },
        _id: false,
      },
    ],
    note: { type: String, default: "", maxlength: 1000 },
    scheduledAt: { type: Date, default: null },
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", default: null },
    responseNote: { type: String, default: "", maxlength: 500 },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

MentorshipSessionSchema.index({ instructor: 1, status: 1, createdAt: 1 })
MentorshipSessionSchema.index({ student: 1, createdAt: -1 })
// One open request per enrollment, race-safe (the InstructorApplication precedent).
MentorshipSessionSchema.index(
  { enrollment: 1 },
  { unique: true, partialFilterExpression: { status: "requested" } }
)

export const MentorshipSession: Model<IMentorshipSession> =
  mongoose.models.MentorshipSession ||
  mongoose.model<IMentorshipSession>("MentorshipSession", MentorshipSessionSchema)
