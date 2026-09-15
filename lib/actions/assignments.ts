"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { Assignment, Course, Submission, User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { notifyUser } from "@/lib/notify"
import { getCourseAccess } from "@/lib/course-access"
import {
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  generateSubmissionKey,
  hasPrivateResourceBucket,
  R2_RESOURCE_BUCKET,
  submissionKeyPrefix,
} from "@/lib/r2"

/*
 * Practical assignments (spec §6, D7 v2). Instructors (course owner or admin)
 * author and grade; students whose package includes `assignments` submit text
 * and files. Files live ONLY in the private resources bucket and leave it only
 * as 5-minute signed URLs minted after an ownership or staff check.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/
const MAX_SUBMISSION_FILES = 3

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
  // The version the instructor was looking at (its ISO submittedAt).
  submittedAt: z.string().min(1, "Submission not found"),
})

/**
 * Grade (or re-grade) a submission; the student is told and can no longer resubmit.
 * Only the version the instructor viewed is graded — a resubmission since then refuses.
 */
export async function gradeSubmission(input: {
  submissionId: string
  grade: number
  feedback: string
  submittedAt: string
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

    const viewedAt = new Date(parsed.data.submittedAt)
    if (Number.isNaN(viewedAt.getTime())) return { success: false, error: "Submission not found" }

    const gradedAt = new Date()
    const graded = await Submission.updateOne(
      { _id: submission._id, submittedAt: viewedAt },
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
    if (graded.matchedCount === 0) {
      return { success: false, error: "The student resubmitted — review the new version" }
    }

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
  fileIndex: z.number().int().min(0, "File not found").max(MAX_SUBMISSION_FILES - 1, "File not found"),
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

/* ═══════════════════ student ═══════════════════ */

const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024
const SUBMISSION_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "application/zip",
  "image/png",
  "image/jpeg",
])
const MIME_ERROR = "Upload a PDF, Word, Excel, PowerPoint, CSV, text, PNG, JPEG or zip file"

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

export type StudentSubmissionFile = SubmissionFileView & { key: string; mimeType: string }

export type StudentAssignment = {
  id: string
  courseId: string
  courseTitle: string
  title: string
  instructions: string
  dueAt: string | null
  submission: {
    id: string
    text: string
    /** The student's own files — keys included so a resubmission can keep them (submitAssignment re-checks the prefix). */
    files: StudentSubmissionFile[]
    submittedAt: string
    status: "submitted" | "graded"
    grade: number | null
    feedback: string
  } | null
}

/** A published assignment on a course where the student's access-granting package includes assignments. */
async function studentAssignmentGate(userId: string, assignmentId: string) {
  const assignment = await Assignment.findOne({ _id: assignmentId, status: "published" }).lean()
  if (!assignment) return { ok: false as const, error: "Assignment not found" }
  const access = await getCourseAccess(userId, assignment.course.toString())
  if (!access) return { ok: false as const, error: "Assignment not found" }
  if (!access.entitlements.assignments) return { ok: false as const, error: "Assignments aren't included in your package" }
  return { ok: true as const, assignment, access }
}

export async function getAssignmentForStudent(
  assignmentId: string
): Promise<{ success: true; data: StudentAssignment } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    if (!OBJECT_ID.test(assignmentId)) return { success: false, error: "Assignment not found" }

    const gate = await studentAssignmentGate(user.id, assignmentId)
    if (!gate.ok) return { success: false, error: gate.error }

    const [course, submission] = await Promise.all([
      Course.findById(gate.assignment.course).select("title").lean(),
      Submission.findOne({ assignment: gate.assignment._id, user: user.id }).lean(),
    ])

    return {
      success: true,
      data: {
        id: gate.assignment._id.toString(),
        courseId: gate.assignment.course.toString(),
        courseTitle: course?.title ?? "",
        title: gate.assignment.title,
        instructions: gate.assignment.instructions ?? "",
        dueAt: gate.assignment.dueAt ? gate.assignment.dueAt.toISOString() : null,
        submission: submission
          ? {
              id: submission._id.toString(),
              text: submission.text ?? "",
              files: (submission.files ?? []).map((file, index) => ({
                index,
                key: file.key,
                filename: file.filename || `File ${index + 1}`,
                mimeType: file.mimeType ?? "",
                sizeBytes: file.sizeBytes ?? 0,
              })),
              submittedAt: submission.submittedAt.toISOString(),
              status: submission.status,
              grade: submission.grade ?? null,
              feedback: submission.feedback ?? "",
            }
          : null,
      },
    }
  } catch (error) {
    console.error("Get assignment for student error:", error)
    return { success: false, error: "Couldn't load the assignment — try again" }
  }
}

const UploadInput = z.object({
  assignmentId: z.string().regex(OBJECT_ID, "Assignment not found"),
  filename: z.string().trim().min(1, "Choose a file").max(200, "Rename the file to under 200 characters"),
  contentType: z.string().max(200),
  sizeBytes: z.number().int().min(1, "Choose a file").max(MAX_SUBMISSION_BYTES, "Files can be up to 25 MB"),
})

/**
 * A presigned PUT into the PRIVATE resources bucket, inside this student's
 * folder for this assignment. The file goes straight from the browser to R2;
 * refused outright when the private bucket isn't configured.
 */
export async function getSubmissionUploadUrl(
  assignmentId: string,
  filename: string,
  contentType: string,
  sizeBytes: number
): Promise<{ success: true; data: { uploadUrl: string; storageKey: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = UploadInput.safeParse({ assignmentId, filename, contentType, sizeBytes })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Choose a file" }
    }

    const gate = await studentAssignmentGate(user.id, parsed.data.assignmentId)
    if (!gate.ok) return { success: false, error: gate.error }
    const existing = await Submission.findOne({ assignment: gate.assignment._id, user: user.id }).select("status").lean()
    if (existing?.status === "graded") return { success: false, error: "This assignment has already been graded" }
    if (!SUBMISSION_MIME.has(parsed.data.contentType)) return { success: false, error: MIME_ERROR }
    if (!hasPrivateResourceBucket()) return { success: false, error: "File uploads aren't available right now" }

    const storageKey = generateSubmissionKey(parsed.data.assignmentId, user.id, parsed.data.filename)
    // The declared size is signed in as Content-Length, so a PUT of any other size fails
    // the signature (R2's enforcement is checked on staging, runbook B7).
    const { uploadUrl } = await generatePresignedUploadUrl(
      storageKey,
      parsed.data.contentType,
      900,
      R2_RESOURCE_BUCKET,
      parsed.data.sizeBytes
    )
    return { success: true, data: { uploadUrl, storageKey } }
  } catch (error) {
    console.error("Submission upload URL error:", error)
    return { success: false, error: "Couldn't prepare the upload — try again" }
  }
}

const SubmitInput = z
  .object({
    assignmentId: z.string().regex(OBJECT_ID, "Assignment not found"),
    text: z.string().trim().max(10000, "Keep your answer under 10,000 characters"),
    files: z
      .array(
        z.object({
          key: z.string().min(1, "Upload your files again").max(300, "Upload your files again"),
          filename: z.string().trim().min(1, "Upload your files again").max(200, "Upload your files again"),
          mimeType: z.string().max(200),
          sizeBytes: z.number().int().min(0).max(MAX_SUBMISSION_BYTES, "Files can be up to 25 MB"),
        })
      )
      .max(MAX_SUBMISSION_FILES, "Attach up to three files"),
  })
  .refine((value) => value.text.length > 0 || value.files.length > 0, {
    message: "Write an answer or attach a file",
  })

/**
 * Submit or resubmit (until graded). Files must already be uploaded through
 * getSubmissionUploadUrl — only keys inside this student's own folder are accepted.
 */
export async function submitAssignment(input: {
  assignmentId: string
  text: string
  files: { key: string; filename: string; mimeType: string; sizeBytes: number }[]
}): Promise<{ success: true; data: { submittedAt: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = SubmitInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check your submission and try again" }
    }

    const gate = await studentAssignmentGate(user.id, parsed.data.assignmentId)
    if (!gate.ok) return { success: false, error: gate.error }

    // A graded student hears that first, whatever else is wrong with the resubmission.
    const existing = await Submission.findOne({ assignment: gate.assignment._id, user: user.id }).select("status").lean()
    if (existing?.status === "graded") return { success: false, error: "This assignment has already been graded" }

    const prefix = submissionKeyPrefix(parsed.data.assignmentId, user.id)
    const files = parsed.data.files
    if (files.some((file) => !file.key.startsWith(prefix) || file.key.includes(".."))) {
      return { success: false, error: "Upload your files again" }
    }
    if (files.some((file) => !SUBMISSION_MIME.has(file.mimeType))) return { success: false, error: MIME_ERROR }
    if (files.length > 0 && !hasPrivateResourceBucket()) {
      return { success: false, error: "File uploads aren't available right now" }
    }

    const submittedAt = new Date()
    // One row per student per assignment. A graded row can't match the filter,
    // so a race with grading hits the unique index instead of overwriting a grade.
    const write = () =>
      Submission.findOneAndUpdate(
        { assignment: gate.assignment._id, user: user.id, status: { $ne: "graded" } },
        {
          $set: { text: parsed.data.text, files, status: "submitted", submittedAt },
          $setOnInsert: { course: gate.assignment.course, enrollment: gate.access.enrollmentId },
        },
        { upsert: true, new: true, runValidators: true }
      )
    try {
      await write()
    } catch (error) {
      if (!isDuplicateKey(error)) throw error
      // The filter's status clause turns off MongoDB's own duplicate-key upsert retry, so the
      // losing insert of a double submit lands here too. Only a graded row is a real refusal.
      const current = await Submission.findOne({ assignment: gate.assignment._id, user: user.id }).select("status").lean()
      if (current?.status === "graded") return { success: false, error: "This assignment has already been graded" }
      try {
        await write()
      } catch (retryError) {
        if (isDuplicateKey(retryError)) return { success: false, error: "This assignment has already been graded" }
        throw retryError
      }
    }

    void notifyUser(gate.access.course.instructorId, {
      type: "course",
      title: "New assignment submission",
      body: `${fullName(user, "A student")} submitted ${gate.assignment.title}.`.slice(0, 500),
      href: `/instructor/courses/${gate.assignment.course.toString()}/assignments`,
    })

    revalidatePath(`/dashboard/assignments/${parsed.data.assignmentId}`)
    revalidatePath(`/instructor/courses/${gate.assignment.course.toString()}/assignments`)
    return { success: true, data: { submittedAt: submittedAt.toISOString() } }
  } catch (error) {
    console.error("Submit assignment error:", error)
    return { success: false, error: "Couldn't submit — try again" }
  }
}
