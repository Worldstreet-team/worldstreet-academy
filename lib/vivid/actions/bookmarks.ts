"use server"

import { initAction, type Doc } from "./helpers"

export async function vividToggleBookmark(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const { toggleCourseBookmark } = await import("@/lib/actions/student")
    const result = await toggleCourseBookmark(p.courseId)
    return {
      success: true,
      isBookmarked: result.isBookmarked,
      message: result.isBookmarked ? "Course bookmarked!" : "Bookmark removed.",
    }
  } catch (error) {
    console.error("[Vivid] toggleBookmark error:", error)
    return { success: false, error: "Failed to toggle bookmark" }
  }
}

export async function vividGetBookmarks() {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, bookmarks: [], error: "Not authenticated" }

    const { fetchMyBookmarks } = await import("@/lib/actions/student")
    const bookmarks = await fetchMyBookmarks()

    return {
      success: true,
      bookmarks: Array.isArray(bookmarks) ? bookmarks.map((b: Doc) => ({
        id: b._id?.toString() || b.id,
        courseId: b.course?._id?.toString() || b.courseId,
        courseTitle: b.course?.title || b.title || "Unknown",
        thumbnailUrl: b.course?.thumbnailUrl || b.thumbnailUrl,
        instructorName: b.course?.instructor
          ? `${b.course.instructor.firstName || ""} ${b.course.instructor.lastName || ""}`.trim()
          : b.instructorName || "",
        level: b.course?.level || b.level,
        rating: b.course?.rating?.average || b.rating || 0,
      })) : [],
    }
  } catch (error) {
    console.error("[Vivid] getBookmarks error:", error)
    return { success: false, bookmarks: [], error: "Failed to get bookmarks" }
  }
}
