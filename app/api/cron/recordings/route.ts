import { NextRequest, NextResponse } from "next/server"
import { Readable } from "node:stream"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"
import connectDB from "@/lib/db"
import { Meeting, Recording } from "@/lib/db/models"
import { getRecording, listMeetingRecordings, realtimeConfigured, type RTKRecording } from "@/lib/realtime"
import { hasPrivateResourceBucket, putPrivateObjectStream, recordingKey } from "@/lib/r2"

/**
 * Class recordings → our private bucket.
 *
 * RealtimeKit records every course class (`record_on_start`) and deletes the
 * file 7 days after it is uploaded, so this job copies it into the PRIVATE
 * resources bucket while it can:
 *
 *   1. Course classes (never mentorship sessions) that ended in the last 7
 *      days — or are still "active" because the host closed the tab — and
 *      aren't settled yet (every recording stored, or errored on RealtimeKit).
 *   2. GET /v2/recordings?meeting_id=<rtk room> lists each one's recordings;
 *      each becomes a `Recording` row (pending; unique on the RTK id).
 *   3. An UPLOADED one is claimed with a lease, re-fetched
 *      (GET /v2/recordings/<id>) for a fresh `download_url`, and its download
 *      is streamed into the bucket with one PutObject, then marked `stored`.
 *   4. A failed copy keeps its reason and is retried next run; once the 7-day
 *      window passes it is marked failed for good.
 *
 * Fails closed: without `R2_RESOURCES_BUCKET_NAME` nothing is copied (503) —
 * a recording never lands in the public bucket. Idempotent: the unique RTK id,
 * the lease and the deterministic key make a re-run (or two overlapping runs)
 * safe.
 *
 * Coolify scheduled task (hourly, docs/launch-runbook.md §5):
 *   POST /api/cron/recordings with Authorization: Bearer $CRON_SECRET
 */

/** RealtimeKit keeps a recording this long. */
const WINDOW_MS = 7 * 24 * 3600_000
/** An ended class with every recording settled is skipped once it ended this long ago. */
const SETTLE_MS = 2 * 3600_000
/** A copy in flight longer than this is presumed dead and may be retried. */
const LEASE_MS = 45 * 60_000
const MAX_MEETINGS_PER_RUN = 40
const MAX_COPIES_PER_RUN = 3
/** Stop starting copies after this much of the run — the task's fetch gives up on headers after 5 minutes. */
const RUN_BUDGET_MS = 3 * 60_000
/** R2's single-PUT ceiling (~5 GB). */
const MAX_SINGLE_PUT_BYTES = 5 * 1000 ** 3
const EXPIRED_REASON = "Not copied within RealtimeKit's 7-day retention"

function recordingStart(rec: RTKRecording, fallback: Date): Date {
  const iso = rec.started_time || rec.invoked_time
  const at = iso ? new Date(iso) : null
  return at && !Number.isNaN(at.getTime()) ? at : fallback
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization") ?? ""
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  if (!hasPrivateResourceBucket()) {
    return NextResponse.json({ ok: false, error: "private_bucket_missing" }, { status: 503 })
  }
  if (!realtimeConfigured()) {
    return NextResponse.json({ ok: false, error: "realtime_disabled" }, { status: 503 })
  }

  await connectDB()
  const startedAt = Date.now()
  const windowStart = new Date(startedAt - WINDOW_MS)

  // Past the window: whatever is still uncopied is gone on RealtimeKit's side.
  const expired = await Recording.updateMany(
    { status: { $in: ["pending", "failed"] }, recordedAt: { $lt: windowStart }, failureReason: { $ne: EXPIRED_REASON } },
    { $set: { status: "failed", failureReason: EXPIRED_REASON, copyStartedAt: null } }
  )

  const candidates = await Meeting.find({
    courseId: { $ne: null },
    mentorshipSessionId: null,
    $or: [
      // startedAt: a cancelled class (ended before it started) has nothing to copy.
      { status: "ended", endedAt: { $gte: windowStart }, startedAt: { $ne: null } },
      { status: "active", startedAt: { $gte: windowStart } },
    ],
  })
    .sort({ startedAt: -1 })
    .limit(200)
    .select("title hostId courseId meetingId status startedAt endedAt")
    .lean()

  const rows = await Recording.find({ meeting: { $in: candidates.map((m) => m._id) } })
    .select("meeting status rtkStatus")
    .lean()
  const rowsByMeeting = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = row.meeting.toString()
    rowsByMeeting.set(key, [...(rowsByMeeting.get(key) ?? []), row])
  }
  const due = candidates
    .filter((m) => {
      const mine = rowsByMeeting.get(m._id.toString()) ?? []
      const settled =
        m.status === "ended" &&
        !!m.endedAt &&
        startedAt - m.endedAt.getTime() > SETTLE_MS &&
        mine.length > 0 &&
        mine.every((r) => r.status === "stored" || r.rtkStatus === "ERRORED")
      return !settled
    })
    .slice(0, MAX_MEETINGS_PER_RUN)

  let listed = 0
  let stored = 0
  let failed = 0
  let waiting = 0
  let copies = 0

  for (const meeting of due) {
    if (!meeting.courseId) continue
    const meetingId = meeting._id.toString()
    const courseId = meeting.courseId.toString()

    let recordings: RTKRecording[]
    try {
      recordings = await listMeetingRecordings(meeting.meetingId)
      listed++
    } catch (error) {
      console.error("[cron/recordings] list failed", meetingId, error)
      continue
    }

    const fallbackStart = meeting.startedAt ?? new Date(startedAt)
    const ordered = [...recordings].sort(
      (a, b) => recordingStart(a, fallbackStart).getTime() - recordingStart(b, fallbackStart).getTime()
    )

    for (const [index, rec] of ordered.entries()) {
      if (!rec?.id) continue
      const errored = rec.status === "ERRORED"
      try {
        await Recording.updateOne(
          { rtkRecordingId: rec.id },
          {
            $setOnInsert: {
              meeting: meeting._id,
              course: meeting.courseId,
              host: meeting.hostId,
              rtkRecordingId: rec.id,
              status: errored ? "failed" : "pending",
              failureReason: errored ? "RealtimeKit couldn't record this session" : null,
              recordedAt: recordingStart(rec, fallbackStart),
              title: index === 0 ? meeting.title : `${meeting.title} · Part ${index + 1}`,
            },
            $set: { rtkStatus: rec.status },
          },
          { upsert: true }
        )
      } catch (error) {
        // A racing run inserted it first — carry on with that row.
        if (!isDuplicateKey(error)) {
          console.error("[cron/recordings] upsert failed", rec.id, error)
          continue
        }
      }
      if (errored) {
        await Recording.updateOne(
          { rtkRecordingId: rec.id, status: "pending" },
          { $set: { status: "failed", failureReason: "RealtimeKit couldn't record this session" } }
        )
        continue
      }
      if (rec.status !== "UPLOADED") {
        waiting++
        continue
      }
      if (copies >= MAX_COPIES_PER_RUN || Date.now() - startedAt > RUN_BUDGET_MS) continue

      const claimed = await Recording.findOneAndUpdate(
        {
          rtkRecordingId: rec.id,
          status: { $in: ["pending", "failed"] },
          failureReason: { $ne: EXPIRED_REASON },
          $or: [{ copyStartedAt: null }, { copyStartedAt: { $lt: new Date(Date.now() - LEASE_MS) } }],
        },
        { $set: { copyStartedAt: new Date() }, $inc: { attempts: 1 } },
        { new: true }
      )
      if (!claimed) continue // stored already, or another run holds the lease
      copies++

      try {
        // The listed link may be near its expiry — ask for a fresh one.
        const fresh = (await getRecording(rec.id)) ?? rec
        const url = fresh.download_url || rec.download_url
        if (!url) throw new Error("RealtimeKit returned no download link")

        const res = await fetch(url)
        if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status})`)
        const length = Number(res.headers.get("content-length")) || fresh.file_size || rec.file_size || 0
        if (!length) {
          await res.body.cancel()
          throw new Error("RealtimeKit didn't say how large the file is")
        }
        if (length > MAX_SINGLE_PUT_BYTES) {
          await res.body.cancel()
          throw new Error("Larger than a single R2 upload (5 GB)")
        }
        const sourceType = res.headers.get("content-type") ?? ""
        const key = recordingKey(courseId, meetingId, rec.id)

        await putPrivateObjectStream(
          key,
          Readable.fromWeb(res.body as unknown as NodeReadableStream<Uint8Array>),
          length,
          sourceType.startsWith("video/") ? sourceType : "video/mp4"
        )

        await Recording.updateOne(
          { _id: claimed._id },
          {
            $set: {
              status: "stored",
              storageKey: key,
              sizeBytes: length,
              durationSeconds: Math.round(fresh.recording_duration ?? rec.recording_duration ?? 0),
              storedAt: new Date(),
              failureReason: null,
              copyStartedAt: null,
              rtkStatus: "UPLOADED",
            },
          }
        )
        stored++
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Copy failed"
        console.error("[cron/recordings] copy failed", rec.id, error)
        await Recording.updateOne(
          { _id: claimed._id },
          { $set: { status: "failed", failureReason: reason.slice(0, 300), copyStartedAt: null } }
        )
        failed++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    meetings: due.length,
    listed,
    stored,
    failed,
    waiting,
    expired: expired.modifiedCount,
  })
}
