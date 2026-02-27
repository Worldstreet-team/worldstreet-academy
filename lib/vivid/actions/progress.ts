"use server"

import { Enrollment, Lesson } from "@/lib/db/models"
import { Types } from "mongoose"
import { initAction } from "./helpers"

export async function vividMarkLessonComplete(p: { courseId: string; lessonId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { markLessonComplete } = await import("@/lib/actions/student")
    await markLessonComplete(p.courseId, p.lessonId)
    return { success: true, message: "Lesson marked as complete!" }
  } catch (error) {
    console.error("[Vivid] markLessonComplete error:", error)
    return { success: false, error: "Failed to mark lesson complete" }
  }
}

export async function vividMarkCourseComplete(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { markCourseComplete } = await import("@/lib/actions/student")
    await markCourseComplete(p.courseId)
    return { success: true, message: "Course completed! Your certificate is ready." }
  } catch (error) {
    console.error("[Vivid] markCourseComplete error:", error)
    return { success: false, error: "Failed to mark course complete" }
  }
}

export async function vividGetWatchProgress(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { getCourseWatchProgress } = await import("@/lib/actions/watch-progress")
    const progress = await getCourseWatchProgress(p.courseId)

    const enrollment = await Enrollment.findOne({ user: currentUser.id, course: p.courseId })
      .select("progress completedLessons")
      .lean()

    return {
      success: true,
      courseId: p.courseId,
      overallProgress: enrollment?.progress || 0,
      completedLessonCount: enrollment?.completedLessons?.length || 0,
      lessonProgress: progress || [],
    }
  } catch (error) {
    console.error("[Vivid] getWatchProgress error:", error)
    return { success: false, error: "Failed to get watch progress" }
  }
}

export async function vividGetCompletedLessons(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { getCompletedLessons } = await import("@/lib/actions/student")
    const completed = await getCompletedLessons(p.courseId)

    const lessons = await Lesson.find({ course: p.courseId, isPublished: true })
      .sort({ order: 1 })
      .select("_id title order")
      .lean()

    const completedSet = new Set(
      Array.isArray(completed) ? completed.map((id: string | Types.ObjectId) => id.toString()) : []
    )

    return {
      success: true,
      courseId: p.courseId,
      totalLessons: lessons.length,
      completedCount: completedSet.size,
      lessons: lessons.map((l, i) => ({
        id: l._id.toString(),
        title: l.title,
        order: l.order || i + 1,
        isCompleted: completedSet.has(l._id.toString()),
      })),
    }
  } catch (error) {
    console.error("[Vivid] getCompletedLessons error:", error)
    return { success: false, error: "Failed to get completed lessons" }
  }
}
