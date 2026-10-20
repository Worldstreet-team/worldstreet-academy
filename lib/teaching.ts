import "server-only"

import mongoose, { Types } from "mongoose"
import { Course, User } from "@/lib/db/models"
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

/** An assigned faculty member as a learner sees them. */
export type ProgramTeacher = { id: string; name: string; avatarUrl: string | null; headline: string | null }

/**
 * Per program: its assigned faculty who still hold a faculty role, in the
 * order they were assigned. A learner sees (and messages) them in place of the
 * owner. A course with none, or that isn't a program, is absent from the map.
 */
export async function assignedFacultyFor(courseIds: string[]): Promise<Map<string, ProgramTeacher[]>> {
  const out = new Map<string, ProgramTeacher[]>()
  const ids = [...new Set(courseIds)].filter((id) => mongoose.isValidObjectId(id))
  if (ids.length === 0) return out
  const courses = await Course.find({ _id: { $in: ids }, "teachingFaculty.0": { $exists: true }, ...PROGRAM_KIND_FILTER })
    .select("teachingFaculty")
    .lean()
  if (courses.length === 0) return out
  const people = await User.find({
    _id: { $in: courses.flatMap((c) => c.teachingFaculty ?? []) },
    role: { $in: ["INSTRUCTOR", "ADMIN"] },
  })
    .select("firstName lastName avatarUrl instructorProfile.headline")
    .lean()
  const byId = new Map(people.map((p) => [p._id.toString(), p]))
  for (const course of courses) {
    const members = (course.teachingFaculty ?? []).flatMap((id) => {
      const p = byId.get(id.toString())
      if (!p) return []
      return [
        {
          id: p._id.toString(),
          name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Faculty member",
          avatarUrl: p.avatarUrl ?? null,
          headline: p.instructorProfile?.headline ?? null,
        },
      ]
    })
    if (members.length > 0) out.set(course._id.toString(), members)
  }
  return out
}

/**
 * Who hears about a course's teaching work (a mentorship request, a
 * submission, an Executive intake): its owner plus its assigned faculty who
 * still hold a faculty role, once each.
 */
export async function courseTeacherIds(courseId: string): Promise<string[]> {
  if (!mongoose.isValidObjectId(courseId)) return []
  const course = await Course.findById(courseId).select("instructor").lean()
  if (!course) return []
  const faculty = (await assignedFacultyFor([courseId])).get(courseId) ?? []
  return [...new Set([course.instructor.toString(), ...faculty.map((f) => f.id)])]
}
