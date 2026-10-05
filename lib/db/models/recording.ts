import mongoose, { Schema, Document, Model, Types } from "mongoose"

/**
 * One cloud recording of a live course class, copied off RealtimeKit (which
 * deletes its copy after 7 days) into the PRIVATE resources bucket by
 * `/api/cron/recordings`. Course classes record automatically
 * (`record_on_start`); mentorship sessions are never recorded.
 *
 *   pending → stored            (copied; `storageKey` is playable)
 *   pending → failed → stored   (a copy error is retried every run while the
 *                                7-day window lasts; `failureReason` says why)
 *
 * Storage rule: only `storageKey` is kept, never a URL. Playback mints a
 * 10-minute signed GET after re-checking access (lib/actions/recordings.ts).
 *
 * Web-only collection — the Go API doesn't read it.
 */

export type RecordingStatus = "pending" | "stored" | "failed"

export interface IRecording extends Document {
  _id: Types.ObjectId
  meeting: Types.ObjectId
  course: Types.ObjectId
  host: Types.ObjectId
  /** RealtimeKit's recording id (unique). */
  rtkRecordingId: string
  /** RealtimeKit's last reported state (INVOKED … UPLOADED | ERRORED). */
  rtkStatus: string
  status: RecordingStatus
  /** `worldstreet-academy/recordings/<courseId>/<meetingId>/<rtkRecordingId>.mp4` in the private bucket; null until stored. */
  storageKey: string | null
  /** Seconds. */
  durationSeconds: number
  sizeBytes: number
  /** When RealtimeKit started recording. */
  recordedAt: Date
  title: string
  /** The instructor hid it from students. */
  hidden: boolean
  failureReason: string | null
  attempts: number
  /** Lease: a copy in flight since then (another run skips it until it goes stale). */
  copyStartedAt: Date | null
  storedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const RecordingSchema = new Schema<IRecording>(
  {
    meeting: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    host: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rtkRecordingId: { type: String, required: true, unique: true },
    rtkStatus: { type: String, default: "" },
    status: { type: String, enum: ["pending", "stored", "failed"], default: "pending" },
    storageKey: { type: String, default: null },
    durationSeconds: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    recordedAt: { type: Date, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    hidden: { type: Boolean, default: false },
    failureReason: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    copyStartedAt: { type: Date, default: null },
    storedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "recordings" }
)

RecordingSchema.index({ course: 1, status: 1, recordedAt: -1 })

if (process.env.NODE_ENV === "development" && mongoose.models.Recording) {
  delete mongoose.models.Recording
}

export const Recording: Model<IRecording> =
  (mongoose.models.Recording as Model<IRecording>) || mongoose.model<IRecording>("Recording", RecordingSchema)
