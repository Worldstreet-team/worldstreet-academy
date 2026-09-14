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

export async function getCourseAccess(userId: string, courseId: string): Promise<CourseAccess | null> {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(courseId)) return null
  await connectDB()
  const [enrollment, course] = await Promise.all([
    Enrollment.findOne({ user: userId, course: courseId, status: { $in: ["active", "completed"] } })
      .select("_id packageKey packageName")
      .lean(),
    Course.findById(courseId).select("slug instructor packages").lean(),
  ])
  if (!enrollment || !course) return null
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

/**
 * Ids of the course's lessons this enrollment's package can't open. Empty when
 * there is no access-granting enrollment (other gates decide) or nothing is tiered.
 */
export async function lockedLessonIds(access: CourseAccess | null): Promise<Set<string>> {
  if (!access) return new Set()
  const lessons = await Lesson.find({ course: access.course.id }).select("_id minPackageKey isFree").lean()
  return new Set(
    lessons
      .filter((lesson) => !canAccessLesson(access.course, lesson, access))
      .map((lesson) => lesson._id.toString())
  )
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
