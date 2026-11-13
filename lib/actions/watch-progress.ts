"use server"

import connectDB from "@/lib/db"
import { Lesson, WatchProgress } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { isLessonLockedFor } from "@/lib/course-access"

// 2026-11-12: ids arrive from the browser untyped; only id strings reach a query.
const OBJECT_ID = /^[a-f0-9]{24}$/
function isId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID.test(value)
}

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
    // 2026-11-12: a NaN, negative or endless position (a live stream reports
    // Infinity) is never stored, and the lesson must belong to the course named.
    if (!isId(courseId) || !isId(lessonId)) return { success: false }
    if (
      typeof currentTime !== "number" ||
      typeof duration !== "number" ||
      !Number.isFinite(currentTime) ||
      !Number.isFinite(duration) ||
      currentTime < 0 ||
      duration <= 0 ||
      duration > 24 * 3600
    ) {
      return { success: false }
    }
    currentTime = Math.min(currentTime, duration)
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false }

    if (!(await Lesson.exists({ _id: lessonId, course: courseId }))) return { success: false }
    if (await isLessonLockedFor(user.id, lessonId)) return { success: false }

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
    if (!isId(courseId)) return []
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
    if (!isId(lessonId)) return null
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null

    if (await isLessonLockedFor(user.id, lessonId)) return null

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
