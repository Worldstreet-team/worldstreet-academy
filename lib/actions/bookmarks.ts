"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/db"
import { Bookmark, Course } from "@/lib/db/models"

// ============================================================================
// TYPES
// ============================================================================

export type BookmarkedCourse = {
  id: string
  courseId: string
  courseTitle: string
  courseSlug: string
  courseThumbnail: string | null
  courseLevel: string
  coursePrice: number
  coursePricing: string
  instructorName: string
  rating: number
  enrolledCount: number
  bookmarkedAt: string
}

// ============================================================================
// BOOKMARK ACTIONS
// ============================================================================

/**
 * Add course to bookmarks
 */
export async function addBookmark(userId: string, courseId: string) {
  try {
    await connectDB()

    // Check if already bookmarked
    const existing = await Bookmark.findOne({
      user: userId,
      course: courseId,
    })

    if (existing) {
      return { success: false, error: "Already bookmarked" }
    }

    // Verify course exists and is published
    const course = await Course.findOne({
      _id: courseId,
      status: "published",
    })

    if (!course) {
      return { success: false, error: "Course not found" }
    }

    // Create bookmark
    await Bookmark.create({
      user: userId,
      course: courseId,
    })

    revalidatePath("/dashboard/courses")
    revalidatePath(`/courses/${courseId}`)

    return { success: true }
  } catch (error) {
    console.error("Add bookmark error:", error)
    return { success: false, error: "Failed to add bookmark" }
  }
}

/**
 * Remove course from bookmarks
 */
export async function removeBookmark(userId: string, courseId: string) {
  try {
    await connectDB()

    await Bookmark.findOneAndDelete({
      user: userId,
      course: courseId,
    })

    revalidatePath("/dashboard/courses")
    revalidatePath(`/courses/${courseId}`)

    return { success: true }
  } catch (error) {
    console.error("Remove bookmark error:", error)
    return { success: false, error: "Failed to remove bookmark" }
  }
}

/**
 * Toggle bookmark (add if not exists, remove if exists)
 */
export async function toggleBookmark(userId: string, courseId: string) {
  try {
    await connectDB()

    const existing = await Bookmark.findOne({
      user: userId,
      course: courseId,
    })

    if (existing) {
      await existing.deleteOne()
      revalidatePath("/dashboard/courses")
      revalidatePath(`/courses/${courseId}`)
      return { success: true, isBookmarked: false }
    }

    // Verify course exists
    const course = await Course.findOne({
      _id: courseId,
      status: "published",
    })

    if (!course) {
      return { success: false, error: "Course not found" }
    }

    await Bookmark.create({
      user: userId,
      course: courseId,
    })

    revalidatePath("/dashboard/courses")
    revalidatePath(`/courses/${courseId}`)

    return { success: true, isBookmarked: true }
  } catch (error) {
    console.error("Toggle bookmark error:", error)
    return { success: false, error: "Failed to toggle bookmark" }
  }
}

// ============================================================================
// BOOKMARK QUERIES
// ============================================================================

/**
 * Get user's bookmarked courses
 */
export async function getUserBookmarks(
  userId: string
): Promise<BookmarkedCourse[]> {
  try {
    await connectDB()

    const bookmarks = await Bookmark.find({ user: userId })
      .populate({
        path: "course",
        match: { status: "published" },
        select:
          "title slug thumbnailUrl level price pricing instructor rating enrolledCount",
        populate: {
          path: "instructor",
          select: "firstName lastName",
        },
      })
      .sort({ createdAt: -1 })
      .lean()

    // Filter out any null courses (if course was unpublished after bookmarking)
    return bookmarks
      .filter((b) => b.course !== null)
      .map((bookmark) => {
        const course = bookmark.course as unknown as {
          _id: { toString(): string }
          title: string
          slug: string
          thumbnailUrl: string
          level: string
          price: number
          pricing: string
          instructor: { firstName: string; lastName: string }
          rating: { average: number }
          enrolledCount: number
        }

        return {
          id: bookmark._id.toString(),
          courseId: course._id.toString(),
          courseTitle: course.title,
          courseSlug: course.slug,
          courseThumbnail: course.thumbnailUrl,
          courseLevel: course.level,
          coursePrice: course.price,
          coursePricing: course.pricing,
          instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
          rating: course.rating?.average || 0,
          enrolledCount: course.enrolledCount || 0,
          bookmarkedAt: bookmark.createdAt.toISOString(),
        }
      })
  } catch (error) {
    console.error("Get user bookmarks error:", error)
    return []
  }
}

/**
 * Check if user has bookmarked a course
 */
export async function checkBookmark(
  userId: string,
  courseId: string
): Promise<boolean> {
  try {
    await connectDB()

    const bookmark = await Bookmark.findOne({
      user: userId,
      course: courseId,
    })

    return bookmark !== null
  } catch (error) {
    console.error("Check bookmark error:", error)
    return false
  }
}

/**
 * Get bookmark count for a course
 */
export async function getCourseBookmarkCount(courseId: string): Promise<number> {
  try {
    await connectDB()
    return await Bookmark.countDocuments({ course: courseId })
  } catch (error) {
    console.error("Get bookmark count error:", error)
    return 0
  }
}

/**
 * Check multiple bookmarks at once (for listing pages)
 */
export async function checkMultipleBookmarks(
  userId: string,
  courseIds: string[]
): Promise<Record<string, boolean>> {
  try {
    await connectDB()

    const bookmarks = await Bookmark.find({
      user: userId,
      course: { $in: courseIds },
    }).select("course")

    const bookmarkedIds = new Set(
      bookmarks.map((b) => b.course.toString())
    )

    return courseIds.reduce(
      (acc, id) => {
        acc[id] = bookmarkedIds.has(id)
        return acc
      },
      {} as Record<string, boolean>
    )
  } catch (error) {
    console.error("Check multiple bookmarks error:", error)
    return {}
  }
}
