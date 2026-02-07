"use server"

import connectDB from "@/lib/db"
import { Course, Enrollment, Bookmark, User } from "@/lib/db/models"
import { mockCourses } from "@/lib/mock-data"

// ============================================================================
// TYPES
// ============================================================================

export type BrowseCourse = {
  id: string
  title: string
  description: string
  thumbnailUrl: string | null
  instructorId: string
  instructorName: string
  instructorAvatarUrl: string | null
  level: "beginner" | "intermediate" | "advanced"
  pricing: "free" | "paid"
  price: number | null
  status: string
  totalLessons: number
  totalDuration: number
  enrolledCount: number
  rating: number | null
}

export type StudentEnrollment = {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  instructorName: string
  progress: number
  lastAccessedAt: string
  status: string
}

export type StudentBookmark = {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  instructorName: string
  level: string
  pricing: string
  price: number | null
  rating: number | null
  enrolledCount: number
}

// Demo user ID (in production, get from session/auth)
const DEMO_USER_ID = "demo-user-001"

// ---- Get or create demo user ----
async function getOrCreateDemoUser() {
  await connectDB()
  
  let user = await User.findOne({ email: "student@worldstreet.academy" })
  
  if (!user) {
    user = await User.create({
      email: "student@worldstreet.academy",
      username: "demo_student",
      firstName: "Johnson",
      lastName: "Demo",
      role: "USER",
      walletBalance: 2450.00,
    })
  }
  
  return user
}

// ============================================================================
// BROWSE COURSES (for students)
// ============================================================================

/**
 * Fetch published courses for the browse page
 * Falls back to mock data if database is empty
 */
export async function fetchBrowseCourses(options?: {
  level?: string
  pricing?: string
  search?: string
}): Promise<BrowseCourse[]> {
  try {
    await connectDB()
    
    const query: Record<string, unknown> = { status: "published" }
    
    if (options?.level && options.level !== "All") {
      query.level = options.level.toLowerCase()
    }
    if (options?.pricing) {
      if (options.pricing === "Free") query.price = 0
      else if (options.pricing === "Paid") query.price = { $gt: 0 }
    }
    if (options?.search) {
      query.$or = [
        { title: { $regex: options.search, $options: "i" } },
        { description: { $regex: options.search, $options: "i" } },
      ]
    }
    
    const courses = await Course.find(query)
      .populate("instructor", "firstName lastName avatarUrl")
      .sort({ enrolledCount: -1, createdAt: -1 })
      .lean()
    
    // If no courses in database, return mock data
    if (courses.length === 0) {
      return mockCourses
        .filter((c) => c.status === "published")
        .map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          thumbnailUrl: c.thumbnailUrl,
          instructorId: c.instructorId,
          instructorName: c.instructorName,
          instructorAvatarUrl: c.instructorAvatarUrl,
          level: c.level,
          pricing: c.pricing,
          price: c.price,
          status: c.status,
          totalLessons: c.totalLessons,
          totalDuration: c.totalDuration,
          enrolledCount: c.enrolledCount,
          rating: c.rating,
        }))
    }
    
    return courses.map((course) => {
      const instructor = course.instructor as unknown as {
        _id: { toString(): string }
        firstName: string
        lastName: string
        avatarUrl: string
      }
      
      return {
        id: course._id.toString(),
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        instructorId: instructor._id.toString(),
        instructorName: `${instructor.firstName} ${instructor.lastName}`,
        instructorAvatarUrl: instructor.avatarUrl,
        level: course.level as "beginner" | "intermediate" | "advanced",
        pricing: course.pricing as "free" | "paid",
        price: course.price,
        status: course.status,
        totalLessons: course.totalLessons || 0,
        totalDuration: course.totalDuration || 0,
        enrolledCount: course.enrolledCount || 0,
        rating: course.rating?.average || null,
      }
    })
  } catch (error) {
    console.error("Fetch browse courses error:", error)
    // Return mock data on error
    return mockCourses
      .filter((c) => c.status === "published")
      .map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        instructorId: c.instructorId,
        instructorName: c.instructorName,
        instructorAvatarUrl: c.instructorAvatarUrl,
        level: c.level,
        pricing: c.pricing,
        price: c.price,
        status: c.status,
        totalLessons: c.totalLessons,
        totalDuration: c.totalDuration,
        enrolledCount: c.enrolledCount,
        rating: c.rating,
      }))
  }
}

// ============================================================================
// MY COURSES (enrolled courses)
// ============================================================================

/**
 * Fetch user's enrolled courses
 */
export async function fetchMyEnrollments(): Promise<StudentEnrollment[]> {
  try {
    await connectDB()
    const user = await getOrCreateDemoUser()
    
    const enrollments = await Enrollment.find({ user: user._id })
      .populate({
        path: "course",
        select: "title thumbnailUrl instructor",
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
        lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || new Date().toISOString(),
        status: enrollment.status,
      }
    })
  } catch (error) {
    console.error("Fetch my enrollments error:", error)
    return []
  }
}

// ============================================================================
// FAVORITES/BOOKMARKS
// ============================================================================

/**
 * Fetch user's bookmarked courses
 */
export async function fetchMyBookmarks(): Promise<StudentBookmark[]> {
  try {
    await connectDB()
    const user = await getOrCreateDemoUser()
    
    const bookmarks = await Bookmark.find({ user: user._id })
      .populate({
        path: "course",
        match: { status: "published" },
        select: "title thumbnailUrl instructor level pricing price rating enrolledCount",
        populate: {
          path: "instructor",
          select: "firstName lastName",
        },
      })
      .sort({ createdAt: -1 })
      .lean()
    
    return bookmarks
      .filter((b) => b.course !== null)
      .map((bookmark) => {
        const course = bookmark.course as unknown as {
          _id: { toString(): string }
          title: string
          thumbnailUrl: string
          instructor: { firstName: string; lastName: string }
          level: string
          pricing: string
          price: number
          rating: { average: number }
          enrolledCount: number
        }
        
        return {
          id: bookmark._id.toString(),
          courseId: course._id.toString(),
          courseTitle: course.title,
          courseThumbnail: course.thumbnailUrl,
          instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
          level: course.level,
          pricing: course.pricing,
          price: course.price,
          rating: course.rating?.average || null,
          enrolledCount: course.enrolledCount || 0,
        }
      })
  } catch (error) {
    console.error("Fetch my bookmarks error:", error)
    return []
  }
}

/**
 * Toggle bookmark for a course
 */
export async function toggleCourseBookmark(courseId: string): Promise<{ success: boolean; isBookmarked: boolean }> {
  try {
    await connectDB()
    const user = await getOrCreateDemoUser()
    
    const existing = await Bookmark.findOne({
      user: user._id,
      course: courseId,
    })
    
    if (existing) {
      await existing.deleteOne()
      return { success: true, isBookmarked: false }
    }
    
    await Bookmark.create({
      user: user._id,
      course: courseId,
    })
    
    return { success: true, isBookmarked: true }
  } catch (error) {
    console.error("Toggle bookmark error:", error)
    return { success: false, isBookmarked: false }
  }
}

/**
 * Check if courses are bookmarked
 */
export async function checkCoursesBookmarked(courseIds: string[]): Promise<Record<string, boolean>> {
  try {
    await connectDB()
    const user = await getOrCreateDemoUser()
    
    const bookmarks = await Bookmark.find({
      user: user._id,
      course: { $in: courseIds },
    }).select("course")
    
    const bookmarkedIds = new Set(bookmarks.map((b) => b.course.toString()))
    
    return courseIds.reduce(
      (acc, id) => {
        acc[id] = bookmarkedIds.has(id)
        return acc
      },
      {} as Record<string, boolean>
    )
  } catch (error) {
    console.error("Check bookmarks error:", error)
    return {}
  }
}
