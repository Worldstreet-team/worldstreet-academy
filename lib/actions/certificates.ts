"use server"

import connectDB from "@/lib/db"
import { Enrollment, Course, User } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"

// ============================================================================
// TYPES
// ============================================================================

export type CertificateData = {
  id: string
  studentName: string
  courseTitle: string
  instructorName: string
  completedAt: string
  courseId: string
  instructorSignatureUrl: string | null
  studentSignatureUrl: string | null
}

export type StudentCertificate = {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  instructorName: string
  instructorAvatarUrl: string | null
  completedAt: string
}

export type InstructorCertificateStats = {
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  totalCertificates: number
  ratingAverage: number
  ratingCount: number
}

export type InstructorCourseCertificate = {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  studentAvatarUrl: string | null
  completedAt: string
  hasStudentSigned: boolean
}

// ============================================================================
// STUDENT ACTIONS
// ============================================================================

/**
 * Fetch certificate data for a specific course enrollment
 */
export async function fetchCertificate(courseId: string): Promise<CertificateData | null> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return null

    const enrollment = await Enrollment.findOne({
      user: currentUser.id,
      course: courseId,
      status: "completed",
    }).lean()

    if (!enrollment || !enrollment.completedAt) return null

    const course = await Course.findById(courseId)
      .populate("instructor", "firstName lastName signatureUrl")
      .lean()

    if (!course) return null

    const instructor = course.instructor as unknown as {
      firstName: string
      lastName: string
      signatureUrl: string | null
    }

    const user = await User.findById(currentUser.id).select("firstName lastName signatureUrl").lean()
    if (!user) return null

    return {
      id: enrollment._id.toString(),
      studentName: `${user.firstName} ${user.lastName}`,
      courseTitle: course.title,
      instructorName: `${instructor.firstName} ${instructor.lastName}`,
      completedAt: enrollment.completedAt.toISOString(),
      courseId: courseId,
      instructorSignatureUrl: instructor.signatureUrl ?? null,
      studentSignatureUrl: user.signatureUrl ?? null,
    }
  } catch (error) {
    console.error("Fetch certificate error:", error)
    return null
  }
}

/**
 * Fetch all certificates for the authenticated student
 */
export async function fetchMyCertificates(): Promise<StudentCertificate[]> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const enrollments = await Enrollment.find({
      user: currentUser.id,
      status: "completed",
      completedAt: { $ne: null },
    })
      .populate({
        path: "course",
        select: "title thumbnailUrl instructor",
        populate: {
          path: "instructor",
          select: "firstName lastName avatarUrl",
        },
      })
      .sort({ completedAt: -1 })
      .lean()

    return enrollments
      .filter((e) => e.course)
      .map((enrollment) => {
        const course = enrollment.course as unknown as {
          _id: { toString(): string }
          title: string
          thumbnailUrl: string | null
          instructor: {
            firstName: string
            lastName: string
            avatarUrl: string | null
          }
        }

        return {
          id: enrollment._id.toString(),
          courseId: course._id.toString(),
          courseTitle: course.title,
          courseThumbnail: course.thumbnailUrl,
          instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
          instructorAvatarUrl: course.instructor.avatarUrl,
          completedAt: enrollment.completedAt!.toISOString(),
        }
      })
  } catch (error) {
    console.error("Fetch my certificates error:", error)
    return []
  }
}

// ============================================================================
// INSTRUCTOR ACTIONS
// ============================================================================

/**
 * Fetch certificate stats for all of an instructor's courses
 */
export async function fetchInstructorCertificateStats(): Promise<InstructorCertificateStats[]> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    // Get instructor's courses
    const courses = await Course.find({
      instructor: currentUser.id,
    })
      .select("title thumbnailUrl rating")
      .lean()

    if (courses.length === 0) return []

    // Get certificate counts for each course
    const results = await Promise.all(
      courses.map(async (course) => {
        const certCount = await Enrollment.countDocuments({
          course: course._id,
          status: "completed",
          completedAt: { $ne: null },
        })

        return {
          courseId: course._id.toString(),
          courseTitle: course.title,
          courseThumbnail: course.thumbnailUrl,
          totalCertificates: certCount,
          ratingAverage: course.rating?.average ?? 0,
          ratingCount: course.rating?.count ?? 0,
        }
      })
    )

    return results
  } catch (error) {
    console.error("Fetch instructor certificate stats error:", error)
    return []
  }
}

/**
 * Fetch all certificates for a specific course (instructor only)
 */
export async function fetchCourseCertificates(
  courseId: string
): Promise<InstructorCourseCertificate[]> {
  try {
    await connectDB()
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    // Verify the instructor owns the course
    const course = await Course.findOne({
      _id: courseId,
      instructor: currentUser.id,
    }).lean()

    if (!course) return []

    // Get all completed enrollments for this course
    const enrollments = await Enrollment.find({
      course: courseId,
      status: "completed",
      completedAt: { $ne: null },
    })
      .populate("user", "firstName lastName email avatarUrl signatureUrl")
      .sort({ completedAt: -1 })
      .lean()

    return enrollments.map((enrollment) => {
      const student = enrollment.user as unknown as {
        _id: { toString(): string }
        firstName: string
        lastName: string
        email: string
        avatarUrl: string | null
        signatureUrl: string | null
      }

      return {
        id: enrollment._id.toString(),
        studentId: student._id.toString(),
        studentName: `${student.firstName} ${student.lastName}`,
        studentEmail: student.email,
        studentAvatarUrl: student.avatarUrl,
        completedAt: enrollment.completedAt!.toISOString(),
        hasStudentSigned: !!student.signatureUrl,
      }
    })
  } catch (error) {
    console.error("Fetch course certificates error:", error)
    return []
  }
}
