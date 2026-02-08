"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/db"
import { Course, Lesson, ILesson } from "@/lib/db/models"
import { uploadVideo, deleteFromCloudinary } from "@/lib/cloudinary"
import { z } from "zod/v4"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const CreateLessonSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().optional(),
  type: z.enum(["video", "live"]),
  content: z.string().optional(), // For text lessons
  sectionTitle: z.string().optional(),
  isFree: z.boolean().optional(),
  liveScheduledAt: z.string().optional(), // ISO date string for live lessons
})

const UpdateLessonSchema = CreateLessonSchema.partial()

// ============================================================================
// TYPES
// ============================================================================

export type LessonListItem = {
  id: string
  title: string
  description: string | null
  type: string
  videoDuration: number | null
  videoThumbnailUrl: string | null
  sectionTitle: string | null
  order: number
  isFree: boolean
  isPublished: boolean
}

// ============================================================================
// LESSON ACTIONS
// ============================================================================

/**
 * Create a new lesson
 */
export async function createLesson(
  courseId: string,
  instructorId: string,
  data: z.infer<typeof CreateLessonSchema>
) {
  try {
    await connectDB()

    const validated = CreateLessonSchema.parse(data)

    // Verify course ownership
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    })

    if (!course) {
      return { success: false, error: "Course not found or unauthorized" }
    }

    // Get next order number
    const lastLesson = await Lesson.findOne({ course: courseId })
      .sort({ order: -1 })
      .select("order")
    const order = lastLesson ? lastLesson.order + 1 : 0

    // Create lesson
    const lesson = await Lesson.create({
      ...validated,
      course: courseId,
      order,
      liveScheduledAt: validated.liveScheduledAt
        ? new Date(validated.liveScheduledAt)
        : null,
    })

    // Update course lesson count
    await updateCourseLessonStats(courseId)

    revalidatePath(`/instructor/courses/${courseId}/lessons`)

    return {
      success: true,
      data: { id: lesson._id.toString() },
    }
  } catch (error) {
    console.error("Create lesson error:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid input data", details: error.issues }
    }
    return { success: false, error: "Failed to create lesson" }
  }
}

/**
 * Update lesson details
 */
export async function updateLesson(
  lessonId: string,
  courseId: string,
  instructorId: string,
  data: z.infer<typeof UpdateLessonSchema>
) {
  try {
    await connectDB()

    const validated = UpdateLessonSchema.parse(data)

    // Verify course ownership
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    })

    if (!course) {
      return { success: false, error: "Course not found or unauthorized" }
    }

    // Update lesson
    const lesson = await Lesson.findOneAndUpdate(
      { _id: lessonId, course: courseId },
      {
        ...validated,
        liveScheduledAt: validated.liveScheduledAt
          ? new Date(validated.liveScheduledAt)
          : undefined,
      },
      { new: true }
    )

    if (!lesson) {
      return { success: false, error: "Lesson not found" }
    }

    revalidatePath(`/instructor/courses/${courseId}/lessons`)

    return { success: true, data: { id: lesson._id.toString() } }
  } catch (error) {
    console.error("Update lesson error:", error)
    return { success: false, error: "Failed to update lesson" }
  }
}

/**
 * Upload lesson video
 */
export async function uploadLessonVideo(
  lessonId: string,
  courseId: string,
  instructorId: string,
  file: string // Base64 or URL
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

    const lesson = await Lesson.findOne({ _id: lessonId, course: courseId })

    if (!lesson) {
      return { success: false, error: "Lesson not found" }
    }

    // Delete old video if exists
    if (lesson.videoPublicId) {
      await deleteFromCloudinary(lesson.videoPublicId, "video")
    }

    // Upload new video
    const result = await uploadVideo(file)

    // Update lesson
    lesson.videoUrl = result.url
    lesson.videoPublicId = result.publicId
    lesson.videoDuration = result.duration || null
    lesson.videoThumbnailUrl = result.thumbnailUrl || null
    await lesson.save()

    // Update course duration
    await updateCourseLessonStats(courseId)

    revalidatePath(`/instructor/courses/${courseId}/lessons`)

    return {
      success: true,
      data: {
        url: result.url,
        duration: result.duration,
        thumbnailUrl: result.thumbnailUrl,
      },
    }
  } catch (error) {
    console.error("Upload video error:", error)
    return { success: false, error: "Failed to upload video" }
  }
}

/**
 * Publish/unpublish a lesson
 */
export async function toggleLessonPublish(
  lessonId: string,
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

    const lesson = await Lesson.findOne({ _id: lessonId, course: courseId })

    if (!lesson) {
      return { success: false, error: "Lesson not found" }
    }

    lesson.isPublished = !lesson.isPublished
    await lesson.save()

    // Update course lesson count
    await updateCourseLessonStats(courseId)

    revalidatePath(`/instructor/courses/${courseId}/lessons`)

    return { success: true, data: { isPublished: lesson.isPublished } }
  } catch (error) {
    console.error("Toggle lesson publish error:", error)
    return { success: false, error: "Failed to update lesson" }
  }
}

/**
 * Reorder lessons
 */
export async function reorderLessons(
  courseId: string,
  instructorId: string,
  lessonIds: string[] // Ordered array of lesson IDs
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

    // Update each lesson's order
    await Promise.all(
      lessonIds.map((id, index) =>
        Lesson.findByIdAndUpdate(id, { order: index })
      )
    )

    revalidatePath(`/instructor/courses/${courseId}/lessons`)

    return { success: true }
  } catch (error) {
    console.error("Reorder lessons error:", error)
    return { success: false, error: "Failed to reorder lessons" }
  }
}

/**
 * Delete a lesson
 */
export async function deleteLesson(
  lessonId: string,
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

    const lesson = await Lesson.findOne({ _id: lessonId, course: courseId })

    if (!lesson) {
      return { success: false, error: "Lesson not found" }
    }

    // Delete video from Cloudinary if exists
    if (lesson.videoPublicId) {
      await deleteFromCloudinary(lesson.videoPublicId, "video")
    }

    // Delete lesson
    await lesson.deleteOne()

    // Update course stats
    await updateCourseLessonStats(courseId)

    revalidatePath(`/instructor/courses/${courseId}/lessons`)

    return { success: true }
  } catch (error) {
    console.error("Delete lesson error:", error)
    return { success: false, error: "Failed to delete lesson" }
  }
}

// ============================================================================
// LESSON QUERIES
// ============================================================================

/**
 * Get lessons for a course (instructor view)
 */
export async function getCourseLessons(
  courseId: string,
  instructorId?: string
): Promise<LessonListItem[]> {
  try {
    await connectDB()

    // If instructorId provided, verify ownership
    if (instructorId) {
      const course = await Course.findOne({
        _id: courseId,
        instructor: instructorId,
      })

      if (!course) {
        return []
      }
    }

    const lessons = await Lesson.find({ course: courseId })
      .sort({ order: 1 })
      .lean()

    return lessons.map((lesson) => ({
      id: lesson._id.toString(),
      title: lesson.title,
      description: lesson.description,
      type: lesson.type,
      videoDuration: lesson.videoDuration,
      videoThumbnailUrl: lesson.videoThumbnailUrl,
      sectionTitle: lesson.sectionTitle,
      order: lesson.order,
      isFree: lesson.isFree,
      isPublished: lesson.isPublished,
    }))
  } catch (error) {
    console.error("Get course lessons error:", error)
    return []
  }
}

/**
 * Get lessons for students (only published, respects isFree for preview)
 */
export async function getPublishedLessons(
  courseId: string,
  hasAccess: boolean = false
): Promise<LessonListItem[]> {
  try {
    await connectDB()

    const lessons = await Lesson.find({
      course: courseId,
      isPublished: true,
    })
      .sort({ order: 1 })
      .lean()

    return lessons.map((lesson) => ({
      id: lesson._id.toString(),
      title: lesson.title,
      description: hasAccess || lesson.isFree ? lesson.description : null,
      type: lesson.type,
      videoDuration: lesson.videoDuration,
      videoThumbnailUrl: lesson.videoThumbnailUrl,
      sectionTitle: lesson.sectionTitle,
      order: lesson.order,
      isFree: lesson.isFree,
      isPublished: lesson.isPublished,
    }))
  } catch (error) {
    console.error("Get published lessons error:", error)
    return []
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update course stats (lesson count, total duration)
 */
async function updateCourseLessonStats(courseId: string) {
  const stats = await Lesson.aggregate([
    { $match: { course: courseId, isPublished: true } },
    {
      $group: {
        _id: null,
        totalLessons: { $sum: 1 },
        totalDuration: { $sum: { $ifNull: ["$videoDuration", 0] } },
      },
    },
  ])

  const { totalLessons = 0, totalDuration = 0 } = stats[0] || {}

  await Course.findByIdAndUpdate(courseId, {
    totalLessons,
    totalDuration: Math.ceil(totalDuration / 60), // Convert seconds to minutes
  })
}
