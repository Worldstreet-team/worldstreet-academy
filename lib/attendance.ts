import "server-only"
import { Types, isValidObjectId } from "mongoose"
import connectDB from "@/lib/db"
import { Attendance, type IMeeting } from "@/lib/db/models"
import { bankSeconds, isCourseClass } from "@/lib/attendance-rules"

/**
 * The only writer of `attendances` (Institutional blueprint §12 / D24). Never a
 * "use server" module: as actions these would let anyone touch anyone's rows.
 *
 * A row's `openSince` is the start of the time not yet banked. Banking adds
 * `now - openSince` to `seconds`, but only when that gap is within
 * ATTENDANCE_STALE_MS; a longer silence (a closed tab, a locked phone) adds 0,
 * so only time covered by a heartbeat is credited. Every update is filtered on
 * the `openSince` that was read, so two writers can't bank the same interval.
 *
 * Each function never rejects: it catches, logs `[Attendance] …` and resolves,
 * so attendance can never fail a join, leave, kick or end.
 */
export type AttendanceMeeting = Pick<IMeeting, "_id" | "hostId" | "courseId" | "mentorshipSessionId">

type OpenRow = { _id: Types.ObjectId; openSince: Date }

function toIds(meetingId: string, userId: string): { meeting: Types.ObjectId; user: Types.ObjectId } | null {
  if (!isValidObjectId(meetingId) || !isValidObjectId(userId)) return null
  return { meeting: new Types.ObjectId(meetingId), user: new Types.ObjectId(userId) }
}

/** Banks an open row's interval and sets `openSince` to `next` (null closes it). True when it applied. */
async function settle(row: OpenRow, at: Date, next: Date | null): Promise<boolean> {
  const res = await Attendance.updateOne(
    { _id: row._id, openSince: row.openSince },
    { $inc: { seconds: bankSeconds(row.openSince, at) }, $set: { openSince: next } }
  )
  return res.modifiedCount > 0
}

/** A learner is in the class from `now`. Hosts, ad-hoc meetings and mentorship sessions record nothing. */
export async function openAttendance(meeting: AttendanceMeeting, userId: string, now: Date = new Date()): Promise<void> {
  try {
    if (!isCourseClass(meeting) || meeting.hostId.toString() === userId) return
    if (!isValidObjectId(userId) || !meeting.courseId) return
    await connectDB()
    const key = { meeting: meeting._id, user: new Types.ObjectId(userId) }
    const row = await Attendance.findOne(key).select("openSince").lean()
    if (!row) {
      try {
        await Attendance.create({ ...key, course: meeting.courseId, firstJoinedAt: now, lastJoinedAt: now, openSince: now, seconds: 0 })
      } catch (error) {
        // A parallel join created the row first (E11000) and has opened it already.
        if ((error as { code?: number }).code !== 11000) throw error
      }
      return
    }
    // Rejoin or second session: bank what was open (stale rule), then reopen. Never overwrite seconds.
    await Attendance.updateOne(
      { _id: row._id, openSince: row.openSince ?? null },
      { $inc: { seconds: row.openSince ? bankSeconds(row.openSince, now) : 0 }, $set: { openSince: now, lastJoinedAt: now } }
    )
  } catch (error) {
    console.error("[Attendance] open failed:", error)
  }
}

/** The heartbeat: bank the open interval and restart it. Only an open row; never reopens a closed one. */
export async function bankAttendance(meetingId: string, userId: string, now: Date = new Date()): Promise<void> {
  try {
    const ids = toIds(meetingId, userId)
    if (!ids) return
    await connectDB()
    const row = await Attendance.findOne({ ...ids, openSince: { $ne: null } }).select("openSince").lean()
    if (!row?.openSince) return
    await settle({ _id: row._id, openSince: row.openSince }, now, now)
  } catch (error) {
    console.error("[Attendance] bank failed:", error)
  }
}

/** Leave or kick: bank the open interval by the same rule, then close the row. */
export async function closeAttendance(meetingId: string, userId: string, at: Date = new Date()): Promise<void> {
  try {
    const ids = toIds(meetingId, userId)
    if (!ids) return
    await connectDB()
    // Retry once: a ping may have banked the interval between the read and the update.
    for (let attempt = 0; attempt < 2; attempt++) {
      const row = await Attendance.findOne({ ...ids, openSince: { $ne: null } }).select("openSince").lean()
      if (!row?.openSince) return
      if (await settle({ _id: row._id, openSince: row.openSince }, at, null)) return
    }
  } catch (error) {
    console.error("[Attendance] close failed:", error)
  }
}

/** The class ended: close every open row of the meeting. */
export async function closeAllAttendance(meetingId: string, at: Date): Promise<void> {
  try {
    if (!isValidObjectId(meetingId)) return
    await connectDB()
    const meeting = new Types.ObjectId(meetingId)
    let rows: OpenRow[] = []
    // Second pass retries the rows whose filtered update matched nothing (a ping banked them in between).
    for (let pass = 0; pass < 2; pass++) {
      const found = await Attendance.find({ meeting, openSince: { $ne: null } }).select("openSince").lean()
      rows = found.flatMap((r) => (r.openSince ? [{ _id: r._id, openSince: r.openSince }] : []))
      if (rows.length === 0) return
      await Attendance.bulkWrite(
        rows.map((row) => ({
          updateOne: {
            filter: { _id: row._id, openSince: row.openSince },
            update: { $inc: { seconds: bankSeconds(row.openSince, at) }, $set: { openSince: null } },
          },
        }))
      )
    }
  } catch (error) {
    console.error("[Attendance] close-all failed:", error)
  }
}
