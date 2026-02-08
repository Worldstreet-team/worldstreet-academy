"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/db"
import { Course, Enrollment, User, Lesson } from "@/lib/db/models"
import { Types } from "mongoose"

// ============================================================================
// TYPES
// ============================================================================

export type EnrollmentWithCourse = {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  instructorName: string
  progress: number
  completedLessons: string[]
  lastAccessedAt: string
  status: string
}

export type EnrollmentProgress = {
  progress: number
  completedLessons: string[]
  totalLessons: number
  lastAccessedLesson: string | null
}

// ============================================================================
// ENROLLMENT ACTIONS
// ============================================================================

/**
 * Enroll user in a course (purchase)
 */
export async function enrollInCourse(
  userId: string,
  courseId: string,
  pricePaid: number,
  transactionId?: string
) {
  try {
    await connectDB()

    // Check if already enrolled
    const existing = await Enrollment.findOne({
      user: userId,
      course: courseId,
    })

    if (existing) {
      return { success: false, error: "Already enrolled in this course" }
    }

    // Verify course exists and is published
    const course = await Course.findOne({
      _id: courseId,
      status: "published",
    })

    if (!course) {
      return { success: false, error: "Course not found or not available" }
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      user: userId,
      course: courseId,
      pricePaid,
      transactionId,
      purchasedAt: new Date(),
    })

    // Update course enrolled count
    await Course.findByIdAndUpdate(courseId, {
      $inc: { enrolledCount: 1 },
    })

    // Update instructor stats
    await User.findByIdAndUpdate(course.instructor, {
      $inc: {
        "instructorProfile.totalStudents": 1,
        "instructorProfile.totalEarnings": pricePaid,
      },
    })

    revalidatePath("/dashboard/my-courses")
    revalidatePath(`/courses/${courseId}`)

    return {
      success: true,
      data: { enrollmentId: enrollment._id.toString() },
    }
  } catch (error) {
    console.error("Enroll in course error:", error)
    return { success: false, error: "Failed to enroll in course" }
  }
}

/**
 * Mark a lesson as completed
 */
export async function completeLesson(
  userId: string,
  courseId: string,
  lessonId: string
) {
  try {
    await connectDB()

    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })

    if (!enrollment) {
      return { success: false, error: "Not enrolled in this course" }
    }

    // Add lesson to completed if not already
    const lessonObjectId = new Types.ObjectId(lessonId)
    const lessonIdStr = lessonObjectId.toString()
    const completedIds = enrollment.completedLessons.map((id: Types.ObjectId) => id.toString())
    
    if (!completedIds.includes(lessonIdStr)) {
      enrollment.completedLessons.push(lessonObjectId)
    }

    enrollment.lastAccessedLesson = lessonObjectId
    enrollment.lastAccessedAt = new Date()

    // Calculate progress
    const totalLessons = await Lesson.countDocuments({
      course: courseId,
      isPublished: true,
    })

    enrollment.progress = Math.round(
      (enrollment.completedLessons.length / totalLessons) * 100
    )

    // Check if course is completed
    if (enrollment.progress >= 100) {
      enrollment.status = "completed"
      enrollment.completedAt = new Date()
    }

    await enrollment.save()

    revalidatePath(`/courses/${courseId}/learn/${lessonId}`)
    revalidatePath("/dashboard/my-courses")

    return {
      success: true,
      data: {
        progress: enrollment.progress,
        isCompleted: enrollment.status === "completed",
      },
    }
  } catch (error) {
    console.error("Complete lesson error:", error)
    return { success: false, error: "Failed to update progress" }
  }
}

/**
 * Update last accessed lesson (for resume functionality)
 */
export async function updateLastAccessed(
  userId: string,
  courseId: string,
  lessonId: string
) {
  try {
    await connectDB()

    await Enrollment.findOneAndUpdate(
      { user: userId, course: courseId },
      {
        lastAccessedLesson: lessonId,
        lastAccessedAt: new Date(),
      }
    )

    return { success: true }
  } catch (error) {
    console.error("Update last accessed error:", error)
    return { success: false, error: "Failed to update" }
  }
}

// ============================================================================
// ENROLLMENT QUERIES
// ============================================================================

/**
 * Get user's enrollments (my courses)
 */
export async function getUserEnrollments(
  userId: string,
  status?: "active" | "completed" | "all"
): Promise<EnrollmentWithCourse[]> {
  try {
    await connectDB()

    const query: Record<string, unknown> = { user: userId }
    if (status && status !== "all") {
      query.status = status
    }

    const enrollments = await Enrollment.find(query)
      .populate({
        path: "course",
        select: "title slug thumbnailUrl instructor",
        populate: {
          path: "instructor",
          select: "firstName lastName",
        },
      })
      .sort({ lastAccessedAt: -1 })
      .lean()

    return enrollments.map((enrollment) => {
      const course = enrollment.course as unknown as {
        _id: { toString(): string }
        title: string
        slug: string
        thumbnailUrl: string
        instructor: { firstName: string; lastName: string }
      }

      return {
        id: enrollment._id.toString(),
        courseId: course._id.toString(),
        courseTitle: course.title,
        courseThumbnail: course.thumbnailUrl,
        instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
        progress: enrollment.progress,
        completedLessons: enrollment.completedLessons.map((id: Types.ObjectId) => id.toString()),
        lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || new Date().toISOString(),
        status: enrollment.status,
      }
    })
  } catch (error) {
    console.error("Get user enrollments error:", error)
    return []
  }
}

/**
 * Get enrollment details with progress
 */
export async function getEnrollmentProgress(
  userId: string,
  courseId: string
): Promise<EnrollmentProgress | null> {
  try {
    await connectDB()

    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
    }).lean()

    if (!enrollment) {
      return null
    }

    const totalLessons = await Lesson.countDocuments({
      course: courseId,
      isPublished: true,
    })

    return {
      progress: enrollment.progress,
      completedLessons: enrollment.completedLessons.map((id: Types.ObjectId) => id.toString()),
      totalLessons,
      lastAccessedLesson: enrollment.lastAccessedLesson?.toString() || null,
    }
  } catch (error) {
    console.error("Get enrollment progress error:", error)
    return null
  }
}

/**
 * Check if user is enrolled in a course
 */
export async function checkEnrollment(
  userId: string,
  courseId: string
): Promise<{ isEnrolled: boolean; status?: string }> {
  try {
    await connectDB()

    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
    }).select("status")

    if (!enrollment) {
      return { isEnrolled: false }
    }

    return {
      isEnrolled: true,
      status: enrollment.status,
    }
  } catch (error) {
    console.error("Check enrollment error:", error)
    return { isEnrolled: false }
  }
}

/**
 * Get course students (for instructor)
 */
export async function getCourseStudents(
  courseId: string,
  instructorId: string
) {
  try {
    await connectDB()

    // Verify course ownership
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    })

    if (!course) {
      return { success: false, error: "Course not found or unauthorized" }
    }

    const enrollments = await Enrollment.find({ course: courseId })
      .populate("user", "firstName lastName email")
      .sort({ purchasedAt: -1 })
      .lean()

    return {
      success: true,
      data: enrollments.map((e) => {
        const user = e.user as unknown as {
          _id: { toString(): string }
          firstName: string
          lastName: string
          email: string
        }

        return {
          id: e._id.toString(),
          userId: user._id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          progress: e.progress,
          status: e.status,
          enrolledAt: e.purchasedAt.toISOString(),
          completedAt: e.completedAt?.toISOString() || null,
        }
      }),
    }
  } catch (error) {
    console.error("Get course students error:", error)
    return { success: false, error: "Failed to get students" }
  }
}
