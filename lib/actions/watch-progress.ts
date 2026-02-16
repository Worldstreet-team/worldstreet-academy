"use server"

import connectDB from "@/lib/db"
import { WatchProgress } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"

// ============================================================================
// TYPES
// ============================================================================

export type LessonWatchProgress = {
  lessonId: string
  currentTime: number
  duration: number
  completed: boolean
  /** Percentage watched 0-100 */
  percent: number
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Save the current watch position for a lesson video.
 * Called periodically from the video player (every ~5 seconds).
 */
export async function saveWatchProgress(
  courseId: string,
  lessonId: string,
  currentTime: number,
  duration: number
): Promise<{ success: boolean }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false }

    const completed = duration > 0 && currentTime / duration >= 0.9

    await WatchProgress.findOneAndUpdate(
      { user: user.id, lesson: lessonId },
      {
        user: user.id,
        course: courseId,
        lesson: lessonId,
        currentTime: Math.floor(currentTime),
        duration: Math.floor(duration),
        completed,
      },
      { upsert: true, new: true }
    )

    return { success: true }
  } catch (error) {
    console.error("Save watch progress error:", error)
    return { success: false }
  }
}

/**
 * Get watch progress for all lessons in a course
 */
export async function getCourseWatchProgress(
  courseId: string
): Promise<LessonWatchProgress[]> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return []

    const records = await WatchProgress.find({
      user: user.id,
      course: courseId,
    }).lean()

    return records.map((r) => ({
      lessonId: r.lesson.toString(),
      currentTime: r.currentTime,
      duration: r.duration,
      completed: r.completed,
      percent: r.duration > 0 ? Math.min(100, Math.round((r.currentTime / r.duration) * 100)) : 0,
    }))
  } catch (error) {
    console.error("Get course watch progress error:", error)
    return []
  }
}

/**
 * Get watch progress for a single lesson (used to resume playback position)
 */
export async function getLessonWatchProgress(
  lessonId: string
): Promise<{ currentTime: number; duration: number } | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null

    const record = await WatchProgress.findOne({
      user: user.id,
      lesson: lessonId,
    }).lean()

    if (!record) return null

    return {
      currentTime: record.currentTime,
      duration: record.duration,
    }
  } catch (error) {
    console.error("Get lesson watch progress error:", error)
    return null
  }
}
