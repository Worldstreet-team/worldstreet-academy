import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * Institutional blueprint §12 / D24: one row per learner per course class
 * (`courseId` set, no `mentorshipSessionId`). It is written only by
 * lib/attendance.ts, from the meeting actions and the 60 s heartbeat.
 * `seconds` is the time banked; `openSince` is the start of the time not yet
 * banked, null while the learner is out of the class. New web-only collection
 * that the Go API doesn't read, so mobile joins aren't counted.
 */
export interface IAttendance extends Document {
  _id: Types.ObjectId
  meeting: Types.ObjectId
  course: Types.ObjectId
  user: Types.ObjectId
  firstJoinedAt: Date
  lastJoinedAt: Date
  openSince: Date | null
  seconds: number
  createdAt: Date
  updatedAt: Date
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    meeting: { type: Schema.Types.ObjectId, ref: "Meeting", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    firstJoinedAt: { type: Date, required: true },
    lastJoinedAt: { type: Date, required: true },
    openSince: { type: Date, default: null },
    seconds: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
)

AttendanceSchema.index({ meeting: 1, user: 1 }, { unique: true })

export const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>("Attendance", AttendanceSchema)
