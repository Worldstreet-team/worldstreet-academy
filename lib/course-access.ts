import "server-only"

import mongoose from "mongoose"
import connectDB from "@/lib/db"
import {
  Course,
  Enrollment,
  Lesson,
  type ICoursePackage,
  type IPackageEntitlements,
  type PackageKey,
} from "@/lib/db/models"
import { canAccessLesson, entitlementsFor } from "@/lib/entitlements"

/**
 * Package-aware access for one student on one course — the single lookup the
 * web gates (lessons, materials, assessments, certificates, live classes,
 * instructor Q&A) share. Only access-granting enrollments count (active /
 * completed): a reservation, refund, suspension or cancellation reads as null
 * here and the caller's own enrollment rules handle it. Course staff (the
 * instructor, admins) have no enrollment, so they read as null too — callers
 * that let staff in check that first.
 */
export type CourseAccess = {
  enrollmentId: string
  packageKey: PackageKey | null
  packageName: string | null
  entitlements: IPackageEntitlements
  course: { id: string; slug: string; instructorId: string; packages: ICoursePackage[] }
}

/** Enrollment statuses `getCourseAccess` reads as access-granting (its own `$in` filter). */
const ACCESS_GRANTING_STATUSES: ReadonlySet<string> = new Set(["active", "completed"])

type EnrollmentAccessRow = {
  _id: { toString(): string } | string
  status: string
  packageKey?: PackageKey | null
  packageName?: string | null
}

type CourseAccessRow = {
  _id: { toString(): string } | string
  slug: string
  instructor: { toString(): string } | string
  packages?: ICoursePackage[] | null
}

/**
 * Pure core of `getCourseAccess` — builds the same `CourseAccess` shape from
 * an already-loaded enrollment + course pair, with no DB read. A caller that
 * already has both rows (e.g. from a populate) should use this instead of
 * re-reading them. Mirrors `getCourseAccess`'s own `status: { $in: [...] }`
 * filter: an enrollment whose status isn't access-granting reads as null here
 * too, same as course staff (no enrollment) reading as null there.
 */
export function courseAccessFromRows(
  enrollment: EnrollmentAccessRow,
  course: CourseAccessRow
): CourseAccess | null {
  if (!ACCESS_GRANTING_STATUSES.has(enrollment.status)) return null
  const packages = course.packages ?? []
  const packageKey = enrollment.packageKey ?? null
  return {
    enrollmentId: enrollment._id.toString(),
    packageKey,
    packageName: enrollment.packageName ?? null,
    entitlements: entitlementsFor({ packages }, { packageKey }),
    course: {
      id: course._id.toString(),
      slug: course.slug,
      instructorId: course.instructor.toString(),
      packages,
    },
  }
}

export async function getCourseAccess(userId: string, courseId: string): Promise<CourseAccess | null> {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(courseId)) return null
  await connectDB()
  const [enrollment, course] = await Promise.all([
    Enrollment.findOne({ user: userId, course: courseId, status: { $in: ["active", "completed"] } })
      .select("_id status packageKey packageName")
      .lean(),
    Course.findById(courseId).select("slug instructor packages").lean(),
  ])
  if (!enrollment || !course) return null
  return courseAccessFromRows(enrollment, course)
}

/**
 * Instructor Q&A gate for opening a NEW conversation. A student (role USER)
 * whose access-granting enrollments with this person all lack `instructorQa`
 * can't start a thread with them. Existing threads, staff, and people with no
 * enrollment with that instructor are unaffected. Returns the refusal message,
 * or null when the thread may be created.
 */
export async function instructorQaRefusal(
  user: { id: string; role: string },
  recipientId: string
): Promise<string | null> {
  if (user.role !== "USER") return null
  if (!mongoose.isValidObjectId(recipientId)) return null
  await connectDB()
  const taught = await Course.find({ instructor: recipientId }).select("_id packages").lean()
  if (taught.length === 0) return null
  const enrollments = await Enrollment.find({
    user: user.id,
    course: { $in: taught.map((c) => c._id) },
    status: { $in: ["active", "completed"] },
  })
    .select("course packageKey")
    .lean()
  if (enrollments.length === 0) return null
  const coursesById = new Map(taught.map((c) => [c._id.toString(), c]))
  const includesQa = enrollments.some((e) => {
    const course = coursesById.get(e.course.toString())
    return course ? entitlementsFor(course, e).instructorQa : false
  })
  return includesQa ? null : "Instructor Q&A isn't included in your package"
}

type LessonAccessRow = {
  _id: { toString(): string } | string
  minPackageKey?: PackageKey | null
  isFree?: boolean
  isPublished?: boolean
}

/**
 * Pure core of `lockedLessonIds` — filters an already-loaded lesson list
 * (course-wide, published or not) instead of reading it. Empty when there is
 * no access-granting enrollment (other gates decide) or nothing is tiered.
 */
export function lockedLessonIdsFromRows(access: CourseAccess | null, lessons: LessonAccessRow[]): Set<string> {
  if (!access) return new Set()
  return new Set(
    lessons
      .filter((lesson) => !canAccessLesson(access.course, lesson, access))
      .map((lesson) => lesson._id.toString())
  )
}

/**
 * Ids of the course's lessons this enrollment's package can't open. Empty when
 * there is no access-granting enrollment (other gates decide) or nothing is tiered.
 */
export async function lockedLessonIds(access: CourseAccess | null): Promise<Set<string>> {
  if (!access) return new Set()
  const lessons = await Lesson.find({ course: access.course.id }).select("_id minPackageKey isFree").lean()
  return lockedLessonIdsFromRows(access, lessons)
}

/**
 * Pure core of `openPublishedLessonIds` — filters an already-loaded
 * course-wide lesson list instead of reading it (twice). Unpublished rows
 * only feed `lockedLessonIdsFromRows`; they never contribute to the result.
 */
export function openPublishedLessonIdsFromRows(access: CourseAccess, lessons: LessonAccessRow[]): Set<string> {
  const locked = lockedLessonIdsFromRows(access, lessons)
  return new Set(
    lessons
      .filter((lesson) => lesson.isPublished)
      .map((lesson) => lesson._id.toString())
      .filter((id) => !locked.has(id))
  )
}

/**
 * Ids of the course's PUBLISHED lessons this enrollment's package opens — the
 * progress and completion denominator (the same set `completeLesson` counts).
 */
export async function openPublishedLessonIds(access: CourseAccess): Promise<Set<string>> {
  const lessons = await Lesson.find({ course: access.course.id })
    .select("_id minPackageKey isFree isPublished")
    .lean()
  return openPublishedLessonIdsFromRows(access, lessons)
}

/** True only when the user is enrolled on the lesson's course and their package can't open it. */
export async function isLessonLockedFor(userId: string, lessonId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(lessonId)) return false
  await connectDB()
  const lesson = await Lesson.findById(lessonId).select("course minPackageKey isFree").lean()
  if (!lesson) return false
  const access = await getCourseAccess(userId, lesson.course.toString())
  return access ? !canAccessLesson(access.course, lesson, access) : false
}
