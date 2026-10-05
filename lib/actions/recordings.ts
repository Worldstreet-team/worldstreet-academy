"use server"

import { revalidatePath } from "next/cache"
import { Types } from "mongoose"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Course, Enrollment, Recording, User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { getCourseAccess } from "@/lib/course-access"
import { entitlementsFor } from "@/lib/entitlements"
import { generatePresignedDownloadUrl, hasPrivateResourceBucket } from "@/lib/r2"
import { programArt } from "@/lib/school-art"

/*
 * Class recordings (owner, 2026-10-03): every course class is recorded and
 * copied to the private bucket (/api/cron/recordings). Students whose package
 * includes live classes watch them in their dashboard; they can't download
 * them. Course staff (the instructor, the class host, admins) see them too and
 * may rename or hide one. Playback is a 10-minute signed GET minted only after
 * access is re-checked here.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/
/** Signed playback links live this long; the player asks for a fresh one when it expires. */
const PLAYBACK_TTL_SECONDS = 600
const LIST_LIMIT = 100
const STUDENT_PATH = "/dashboard/recordings"
const INSTRUCTOR_PATH = "/instructor/calendar"

type Result<T> = { success: true; data: T } | { success: false; error: string }
type Viewer = { id: string; role: string }

export type RecordingView = {
  id: string
  title: string
  courseId: string
  courseTitle: string
  courseArt: string | null
  hostName: string
  /** ISO. */
  recordedAt: string
  durationSeconds: number
}

export type InstructorRecordingView = RecordingView & {
  meetingId: string
  status: "pending" | "stored" | "failed"
  failureReason: string | null
  hidden: boolean
}

const recordingIdSchema = z.string().regex(OBJECT_ID, "Recording not found")

/** "staff" (admin, course instructor, class host), "student" (package includes live classes), or no access. */
async function recordingAccess(
  user: Viewer,
  rec: { course: Types.ObjectId; host: Types.ObjectId }
): Promise<"staff" | "student" | null> {
  if (user.role === "ADMIN" || rec.host.toString() === user.id) return "staff"
  const course = await Course.findById(rec.course).select("instructor").lean()
  if (course?.instructor?.toString() === user.id) return "staff"
  const access = await getCourseAccess(user.id, rec.course.toString())
  return access?.entitlements.liveClasses ? "student" : null
}

/** Courses whose stored recordings this viewer may list: live-class enrollments + courses they teach. Null = all (admin). */
async function listableCourseIds(user: Viewer): Promise<Types.ObjectId[] | null> {
  if (user.role === "ADMIN") return null
  const userId = new Types.ObjectId(user.id)
  const [enrollments, taught] = await Promise.all([
    Enrollment.find({ user: userId, status: { $in: ["active", "completed"] } })
      .select("course packageKey")
      .lean(),
    Course.find({ instructor: userId }).select("_id").lean(),
  ])
  const courses = enrollments.length
    ? await Course.find({ _id: { $in: enrollments.map((e) => e.course) } }).select("packages").lean()
    : []
  const byId = new Map(courses.map((c) => [c._id.toString(), c]))
  const ids = new Map<string, Types.ObjectId>()
  for (const e of enrollments) {
    const course = byId.get(e.course.toString())
    if (course && entitlementsFor(course, e).liveClasses) ids.set(e.course.toString(), e.course)
  }
  for (const c of taught) ids.set(c._id.toString(), c._id)
  return [...ids.values()]
}

type RecordingRow = {
  _id: Types.ObjectId
  meeting: Types.ObjectId
  course: Types.ObjectId
  host: Types.ObjectId
  title: string
  recordedAt: Date
  durationSeconds: number
  status: "pending" | "stored" | "failed"
  failureReason: string | null
  hidden: boolean
}

/** Rows → views, same order. */
async function toViews(rows: RecordingRow[]): Promise<RecordingView[]> {
  const courseIds = [...new Set(rows.map((r) => r.course.toString()))]
  const hostIds = [...new Set(rows.map((r) => r.host.toString()))]
  const [courses, hosts] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).select("title thumbnailUrl school slug").lean(),
    User.find({ _id: { $in: hostIds } }).select("firstName lastName").lean(),
  ])
  const courseById = new Map(courses.map((c) => [c._id.toString(), c]))
  const hostById = new Map(hosts.map((h) => [h._id.toString(), h]))
  return rows.map((row) => {
    const course = courseById.get(row.course.toString())
    const host = hostById.get(row.host.toString())
    return {
      id: row._id.toString(),
      title: row.title,
      courseId: row.course.toString(),
      courseTitle: course?.title ?? "",
      courseArt: course ? programArt(course) : null,
      hostName: host ? `${host.firstName ?? ""} ${host.lastName ?? ""}`.trim() : "",
      recordedAt: row.recordedAt.toISOString(),
      durationSeconds: row.durationSeconds ?? 0,
    }
  })
}

const ROW_FIELDS = "meeting course host title recordedAt durationSeconds status failureReason hidden"

/**
 * Stored, visible recordings the viewer may watch, newest first — one course
 * (a course page's "Past classes") or all of theirs (/dashboard/recordings).
 * A course the viewer has no live-class access to lists nothing.
 */
export async function listMyRecordings(input: { courseId?: string } = {}): Promise<Result<RecordingView[]>> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    const parsed = z.object({ courseId: z.string().regex(OBJECT_ID, "Course not found").optional() }).safeParse(input)
    if (!parsed.success) return { success: false, error: "Course not found" }

    let filter: Record<string, unknown>
    if (parsed.data.courseId) {
      const courseId = new Types.ObjectId(parsed.data.courseId)
      const course = await Course.findById(courseId).select("instructor").lean()
      if (!course) return { success: true, data: [] }
      const staff = user.role === "ADMIN" || course.instructor?.toString() === user.id
      if (!staff) {
        const access = await getCourseAccess(user.id, parsed.data.courseId)
        if (!access?.entitlements.liveClasses) return { success: true, data: [] }
      }
      filter = { course: courseId }
    } else {
      const ids = await listableCourseIds(user)
      if (ids && ids.length === 0) return { success: true, data: [] }
      filter = ids ? { course: { $in: ids } } : {}
    }

    const rows = await Recording.find({ ...filter, status: "stored", hidden: false })
      .sort({ recordedAt: -1 })
      .limit(LIST_LIMIT)
      .select(ROW_FIELDS)
      .lean<RecordingRow[]>()
    return { success: true, data: await toViews(rows) }
  } catch (error) {
    console.error("[Recordings] list failed:", error)
    return { success: false, error: "Couldn't load recordings" }
  }
}

/**
 * A 10-minute signed link to play one recording. Access is re-checked on
 * every call (a refund or package change ends it); hidden recordings play for
 * course staff only. Fails closed without the private bucket.
 */
export async function getRecordingPlayback(
  recordingId: string
): Promise<Result<{ url: string; title: string; expiresAt: string }>> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    const parsed = recordingIdSchema.safeParse(recordingId)
    if (!parsed.success) return { success: false, error: "Recording not found" }
    if (!hasPrivateResourceBucket()) return { success: false, error: "Recordings aren't available right now" }

    const rec = await Recording.findById(parsed.data).select("course host title status storageKey hidden").lean()
    if (!rec) return { success: false, error: "Recording not found" }
    const access = await recordingAccess(user, rec)
    if (!access || (rec.hidden && access !== "staff")) {
      return { success: false, error: "Recordings are for students whose package includes live classes" }
    }
    if (rec.status !== "stored" || !rec.storageKey) {
      return { success: false, error: "This recording is still being processed" }
    }

    const url = await generatePresignedDownloadUrl(rec.storageKey, {
      expiresIn: PLAYBACK_TTL_SECONDS,
      bucket: process.env.R2_RESOURCES_BUCKET_NAME,
    })
    return {
      success: true,
      data: { url, title: rec.title, expiresAt: new Date(Date.now() + PLAYBACK_TTL_SECONDS * 1000).toISOString() },
    }
  } catch (error) {
    console.error("[Recordings] playback failed:", error)
    return { success: false, error: "Couldn't open this recording" }
  }
}

/** Every recording (any status, hidden too) of the classes this tutor hosts or teaches. */
export async function listInstructorRecordings(): Promise<Result<InstructorRecordingView[]>> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") return { success: false, error: "Instructors only" }

    const userId = new Types.ObjectId(user.id)
    const taught = await Course.find({ instructor: userId }).select("_id").lean()
    const rows = await Recording.find({ $or: [{ host: userId }, { course: { $in: taught.map((c) => c._id) } }] })
      .sort({ recordedAt: -1 })
      .limit(LIST_LIMIT)
      .select(ROW_FIELDS)
      .lean<RecordingRow[]>()
    const views = await toViews(rows)
    return {
      success: true,
      data: views.map((view, i) => ({
        ...view,
        meetingId: rows[i].meeting.toString(),
        status: rows[i].status,
        failureReason: rows[i].failureReason ?? null,
        hidden: !!rows[i].hidden,
      })),
    }
  } catch (error) {
    console.error("[Recordings] instructor list failed:", error)
    return { success: false, error: "Couldn't load recordings" }
  }
}

/** The recording, when the caller is its course staff (admin, course instructor, class host). */
async function staffRecording(
  recordingId: string
): Promise<{ ok: true; recordingId: Types.ObjectId } | { ok: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You need to be signed in" }
  const rec = await Recording.findById(recordingId).select("course host").lean()
  if (!rec) return { ok: false, error: "Recording not found" }
  if ((await recordingAccess(user, rec)) !== "staff") return { ok: false, error: "Only the course's instructor can change this" }
  return { ok: true, recordingId: rec._id }
}

const renameSchema = z.object({
  recordingId: recordingIdSchema,
  title: z.string().trim().min(1, "Give the recording a title").max(200, "Keep the title under 200 characters"),
})

export async function renameRecording(input: { recordingId: string; title: string }): Promise<Result<{ title: string }>> {
  try {
    await connectDB()
    const parsed = renameSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid title" }
    const check = await staffRecording(parsed.data.recordingId)
    if (!check.ok) return { success: false, error: check.error }
    await Recording.updateOne({ _id: check.recordingId }, { $set: { title: parsed.data.title } })
    revalidatePath(INSTRUCTOR_PATH)
    revalidatePath(STUDENT_PATH)
    return { success: true, data: { title: parsed.data.title } }
  } catch (error) {
    console.error("[Recordings] rename failed:", error)
    return { success: false, error: "Couldn't rename this recording" }
  }
}

const hiddenSchema = z.object({ recordingId: recordingIdSchema, hidden: z.boolean() })

export async function setRecordingHidden(input: { recordingId: string; hidden: boolean }): Promise<Result<{ hidden: boolean }>> {
  try {
    await connectDB()
    const parsed = hiddenSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Recording not found" }
    const check = await staffRecording(parsed.data.recordingId)
    if (!check.ok) return { success: false, error: check.error }
    await Recording.updateOne({ _id: check.recordingId }, { $set: { hidden: parsed.data.hidden } })
    revalidatePath(INSTRUCTOR_PATH)
    revalidatePath(STUDENT_PATH)
    return { success: true, data: { hidden: parsed.data.hidden } }
  } catch (error) {
    console.error("[Recordings] hide failed:", error)
    return { success: false, error: "Couldn't update this recording" }
  }
}
