"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Assignment, Course, Submission, User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { notifyUser } from "@/lib/notify"
import { generatePresignedDownloadUrl, hasPrivateResourceBucket, R2_RESOURCE_BUCKET } from "@/lib/r2"

/*
 * Practical assignments (spec §6, D7 v2). Instructors (course owner or admin)
 * author and grade; students whose package includes `assignments` submit text
 * and files. Files live ONLY in the private resources bucket and leave it only
 * as 5-minute signed URLs minted after an ownership or staff check.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/

type Viewer = { id: string; role: string }

/** The course instructor or an admin — the authoring and grading gate. */
async function courseStaff(user: Viewer, courseId: string) {
  const course = await Course.findById(courseId).select("instructor title").lean()
  if (!course) return null
  if (course.instructor.toString() !== user.id && user.role !== "ADMIN") return null
  return course
}

function fullName(person: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback: string) {
  const name = `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim()
  return name || fallback
}

/* ═══════════════════ instructor ═══════════════════ */

export type SubmissionFileView = { index: number; filename: string; sizeBytes: number }

export type InstructorSubmission = {
  id: string
  studentName: string
  submittedAt: string
  text: string
  /** Downloads go through getSubmissionFileUrl by index — storage keys never reach this view. */
  files: SubmissionFileView[]
  status: "submitted" | "graded"
  grade: number | null
  feedback: string
}

export type InstructorAssignment = {
  id: string
  title: string
  instructions: string
  dueAt: string | null
  status: "draft" | "published"
  submissions: InstructorSubmission[]
}

export type CourseAssignments = { courseTitle: string; assignments: InstructorAssignment[] }

export async function getCourseAssignments(courseId: string): Promise<CourseAssignments | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user || !OBJECT_ID.test(courseId)) return null
    const course = await courseStaff(user, courseId)
    if (!course) return null

    const assignments = await Assignment.find({ course: courseId }).sort({ createdAt: 1 }).lean()
    const submissions = await Submission.find({ assignment: { $in: assignments.map((a) => a._id) } })
      .sort({ submittedAt: 1 })
      .lean()
    const students = await User.find({ _id: { $in: submissions.map((s) => s.user) } })
      .select("firstName lastName")
      .lean()
    const namesById = new Map(students.map((s) => [s._id.toString(), fullName(s, "Student")]))

    const byAssignment = new Map<string, InstructorSubmission[]>()
    for (const s of submissions) {
      const key = s.assignment.toString()
      const list = byAssignment.get(key) ?? []
      list.push({
        id: s._id.toString(),
        studentName: namesById.get(s.user.toString()) ?? "Student",
        submittedAt: s.submittedAt.toISOString(),
        text: s.text ?? "",
        files: (s.files ?? []).map((file, index) => ({
          index,
          filename: file.filename || `File ${index + 1}`,
          sizeBytes: file.sizeBytes ?? 0,
        })),
        status: s.status,
        grade: s.grade ?? null,
        feedback: s.feedback ?? "",
      })
      byAssignment.set(key, list)
    }

    return {
      courseTitle: course.title,
      assignments: assignments.map((a) => ({
        id: a._id.toString(),
        title: a.title,
        instructions: a.instructions ?? "",
        dueAt: a.dueAt ? a.dueAt.toISOString() : null,
        status: a.status,
        submissions: byAssignment.get(a._id.toString()) ?? [],
      })),
    }
  } catch (error) {
    console.error("Get course assignments error:", error)
    return null
  }
}

const AssignmentInput = z.object({
  courseId: z.string().regex(OBJECT_ID, "Course not found"),
  assignmentId: z.string().regex(OBJECT_ID, "Assignment not found").nullable(),
  title: z.string().trim().min(3, "Give the assignment a title").max(120, "Keep the title under 120 characters"),
  instructions: z
    .string()
    .trim()
    .min(10, "Tell students what to submit")
    .max(5000, "Keep instructions under 5,000 characters"),
  dueAt: z.string().nullable(),
  published: z.boolean(),
})

/** Create (assignmentId null) or edit an assignment; `published` controls student visibility. */
export async function saveAssignment(input: {
  courseId: string
  assignmentId: string | null
  title: string
  instructions: string
  dueAt: string | null
  published: boolean
}): Promise<{ success: true; data: { assignmentId: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = AssignmentInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }
    const course = await courseStaff(user, parsed.data.courseId)
    if (!course) return { success: false, error: "Course not found" }

    let dueAt: Date | null = null
    if (parsed.data.dueAt) {
      dueAt = new Date(parsed.data.dueAt)
      if (Number.isNaN(dueAt.getTime())) return { success: false, error: "Pick a valid due date" }
    }
    const fields = {
      title: parsed.data.title,
      instructions: parsed.data.instructions,
      dueAt,
      status: parsed.data.published ? ("published" as const) : ("draft" as const),
    }

    let assignmentId: string
    if (parsed.data.assignmentId) {
      const updated = await Assignment.findOneAndUpdate(
        { _id: parsed.data.assignmentId, course: parsed.data.courseId },
        { $set: fields },
        { new: true }
      )
      if (!updated) return { success: false, error: "Assignment not found" }
      assignmentId = updated._id.toString()
    } else {
      const created = await Assignment.create({ course: parsed.data.courseId, instructor: course.instructor, ...fields })
      assignmentId = created._id.toString()
    }

    revalidatePath(`/instructor/courses/${parsed.data.courseId}/assignments`)
    revalidatePath("/dashboard/assignments")
    return { success: true, data: { assignmentId } }
  } catch (error) {
    console.error("Save assignment error:", error)
    return { success: false, error: "Couldn't save the assignment — try again" }
  }
}

const GradeInput = z.object({
  submissionId: z.string().regex(OBJECT_ID, "Submission not found"),
  grade: z
    .number({ error: "Enter a grade from 0 to 100" })
    .int("Grades are whole numbers")
    .min(0, "Enter a grade from 0 to 100")
    .max(100, "Enter a grade from 0 to 100"),
  feedback: z.string().trim().max(5000, "Keep feedback under 5,000 characters"),
})

/** Grade (or re-grade) a submission; the student is told and can no longer resubmit. */
export async function gradeSubmission(input: {
  submissionId: string
  grade: number
  feedback: string
}): Promise<{ success: true; data: { gradedAt: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = GradeInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the grade and try again" }
    }

    const submission = await Submission.findById(parsed.data.submissionId).select("course user assignment").lean()
    if (!submission) return { success: false, error: "Submission not found" }
    const course = await courseStaff(user, submission.course.toString())
    if (!course) return { success: false, error: "Submission not found" }

    const gradedAt = new Date()
    await Submission.updateOne(
      { _id: submission._id },
      {
        $set: {
          status: "graded",
          grade: parsed.data.grade,
          feedback: parsed.data.feedback,
          gradedBy: user.id,
          gradedAt,
        },
      }
    )

    const assignment = await Assignment.findById(submission.assignment).select("title").lean()
    const assignmentId = submission.assignment.toString()
    void notifyUser(submission.user.toString(), {
      type: "course",
      title: "Assignment graded",
      body: `${assignment?.title ?? "Your assignment"} (${course.title}): ${parsed.data.grade}/100.`.slice(0, 500),
      href: `/dashboard/assignments/${assignmentId}`,
    })

    revalidatePath(`/instructor/courses/${submission.course.toString()}/assignments`)
    revalidatePath(`/dashboard/assignments/${assignmentId}`)
    return { success: true, data: { gradedAt: gradedAt.toISOString() } }
  } catch (error) {
    console.error("Grade submission error:", error)
    return { success: false, error: "Couldn't save the grade — try again" }
  }
}

const FileInput = z.object({
  submissionId: z.string().regex(OBJECT_ID, "File not found"),
  fileIndex: z.number().int().min(0, "File not found").max(9, "File not found"),
})

/**
 * A 5-minute signed download for one submission file — for the student who
 * submitted it, the course instructor, or an admin. Never a public URL.
 */
export async function getSubmissionFileUrl(
  submissionId: string,
  fileIndex: number
): Promise<{ success: true; data: { url: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = FileInput.safeParse({ submissionId, fileIndex })
    if (!parsed.success) return { success: false, error: "File not found" }
    if (!hasPrivateResourceBucket()) return { success: false, error: "File storage isn't available right now" }

    const submission = await Submission.findById(parsed.data.submissionId).select("user course files").lean()
    if (!submission) return { success: false, error: "File not found" }
    const isOwner = submission.user.toString() === user.id
    if (!isOwner && !(await courseStaff(user, submission.course.toString()))) {
      return { success: false, error: "File not found" }
    }
    const file = (submission.files ?? [])[parsed.data.fileIndex]
    if (!file) return { success: false, error: "File not found" }

    const url = await generatePresignedDownloadUrl(file.key, {
      expiresIn: 300,
      downloadFilename: file.filename || "submission",
      bucket: R2_RESOURCE_BUCKET,
    })
    return { success: true, data: { url } }
  } catch (error) {
    console.error("Get submission file URL error:", error)
    return { success: false, error: "Couldn't prepare the download — try again" }
  }
}
