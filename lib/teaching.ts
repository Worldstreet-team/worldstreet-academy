import "server-only"

import mongoose, { Types } from "mongoose"
import { Course } from "@/lib/db/models"
import { PROGRAM_KIND_FILTER } from "@/lib/course-kind"

/*
 * Who teaches a course (owner, 2026-10-19: "Assign teaching faculty"). The one
 * place that decides it. A course is taught by its owner (`Course.instructor`)
 * and by the faculty an admin assigned to it (`Course.teachingFaculty`).
 * An assignment counts only on a school program, and only while the person's
 * role is INSTRUCTOR or ADMIN: a faculty member demoted to USER stops teaching
 * at once, even while still listed. Teaching never touches ownership, prices,
 * content or earnings — those stay with `instructor`.
 *
 * Admin access is not decided here: each call site keeps the admin rule it
 * already had.
 */

type Teacher = { id: string; role: string }

function isFaculty(role: string): boolean {
  return role === "INSTRUCTOR" || role === "ADMIN"
}

/**
 * A `Course.find` filter for the courses this user teaches: the ones they own
 * and, while they are faculty, the programs they are assigned to. Anyone else
 * matches only what they own, as before assignments existed.
 */
export function teachingFilter(user: Teacher) {
  const id = new Types.ObjectId(user.id)
  if (!isFaculty(user.role)) return { instructor: id }
  return { $or: [{ instructor: id }, { teachingFaculty: id, ...PROGRAM_KIND_FILTER }] }
}

/**
 * Ids of the courses a faculty member teaches (owns or is assigned to). Empty
 * for anyone else: teaching tools are faculty tools, and a call site that
 * refuses sellers keeps refusing them.
 */
export async function taughtCourseIds(user: Teacher): Promise<Types.ObjectId[]> {
  if (!isFaculty(user.role) || !mongoose.isValidObjectId(user.id)) return []
  const rows = await Course.find(teachingFilter(user)).select("_id").lean()
  return rows.map((row) => row._id)
}

/**
 * The course (lean, with `fields`) when this faculty member teaches it, else
 * null. Null for anyone who isn't faculty.
 */
export async function teachesCourse(user: Teacher, courseId: string, fields = "_id") {
  if (!isFaculty(user.role) || !mongoose.isValidObjectId(user.id) || !mongoose.isValidObjectId(courseId)) return null
  return Course.findOne({ _id: courseId, ...teachingFilter(user) })
    .select(fields)
    .lean()
}
