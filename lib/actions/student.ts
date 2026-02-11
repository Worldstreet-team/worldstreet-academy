"use server"

import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Course, Enrollment, Bookmark, User, Lesson } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"

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
  firstLessonId: string | null
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

// ---- Get authenticated user's MongoDB document ----
async function getAuthenticatedUser() {
  const authUser = await getCurrentUser()
  
  if (!authUser) {
    throw new Error("Not authenticated")
  }
  
  await connectDB()
  const user = await User.findById(authUser.id)
  
  if (!user) {
    throw new Error("User not found in database")
  }
  
  return user
}

// ============================================================================
// BROWSE COURSES (for students)
// ============================================================================

/**
 * Fetch published courses for the browse page
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
    return []
  }
}

// ============================================================================
// PUBLIC COURSE DETAIL
// ============================================================================

export type PublicCourseLesson = {
  id: string
  title: string
  description: string | null
  type: "video" | "live" | "text"
  thumbnailUrl: string | null
  videoUrl: string | null
  content: string | null
  duration: number | null
  isFree: boolean
}

export type PublicCourse = {
  id: string
  title: string
  description: string
  thumbnailUrl: string | null
  instructorId: string
  instructorName: string
  instructorAvatarUrl: string | null
  instructorBio: string | null
  instructorHeadline: string | null
  instructorTotalStudents: number
  level: "beginner" | "intermediate" | "advanced"
  pricing: "free" | "paid"
  price: number | null
  totalLessons: number
  totalDuration: number
  enrolledCount: number
  rating: number | null
  lessons: PublicCourseLesson[]
}

/**
 * Fetch a single published course by ID for public view
 */
export async function fetchPublicCourse(courseId: string): Promise<PublicCourse | null> {
  try {
    await connectDB()
    
    const course = await Course.findOne({
      _id: courseId,
      status: "published",
    })
      .populate("instructor", "firstName lastName avatarUrl bio instructorProfile")
      .lean()
    
    if (!course) return null
    
    const instructor = course.instructor as unknown as {
      _id: string
      firstName: string
      lastName?: string
      avatarUrl: string | null
      bio: string | null
      instructorProfile?: {
        headline: string | null
        totalStudents: number
      }
    } | null
    
    // Guard against missing instructor (deleted user, etc.)
    if (!instructor) return null
    
    // Fetch lessons for this course with all needed fields
    const lessons = await Lesson.find({ course: courseId })
      .sort({ order: 1 })
      .select("title description type videoThumbnailUrl videoUrl content videoDuration isFree")
      .lean()
    
    return {
      id: course._id.toString(),
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      instructorId: instructor._id.toString(),
      instructorName: `${instructor.firstName} ${instructor.lastName || ""}`.trim(),
      instructorAvatarUrl: instructor.avatarUrl,
      instructorBio: instructor.bio,
      instructorHeadline: instructor.instructorProfile?.headline || null,
      instructorTotalStudents: instructor.instructorProfile?.totalStudents || 0,
      level: course.level as "beginner" | "intermediate" | "advanced",
      pricing: course.pricing as "free" | "paid",
      price: course.price,
      totalLessons: course.totalLessons || 0,
      totalDuration: course.totalDuration || 0,
      enrolledCount: course.enrolledCount || 0,
      rating: course.rating?.average || null,
      lessons: lessons.map((l) => ({
        id: l._id.toString(),
        title: l.title,
        description: l.description || null,
        type: l.type as "video" | "live" | "text",
        thumbnailUrl: l.videoThumbnailUrl || null,
        videoUrl: l.isFree ? (l.videoUrl || null) : null, // Only expose video URL for free lessons
        content: l.isFree ? (l.content || null) : null, // Only expose content for free lessons
        duration: l.videoDuration ? Math.round(l.videoDuration / 60) : null,
        isFree: l.isFree,
      })),
    }
  } catch (error) {
    console.error("Fetch public course error:", error)
    return null
  }
}

// ============================================================================
// LEARN PAGE - Course content with full lesson details
// ============================================================================

export type LearnLesson = {
  id: string
  courseId: string
  title: string
  description: string
  type: "video" | "live" | "text"
  videoUrl: string | null
  thumbnailUrl: string | null
  content: string | null
  duration: number | null
  order: number
  isFree: boolean
}

export type LearnCourse = {
  id: string
  title: string
  instructorName: string
  instructorAvatarUrl: string | null
  rating: number | null
  lessons: LearnLesson[]
}

/**
 * Fetch course and lessons for the learn page
 */
export async function fetchCourseForLearning(courseId: string): Promise<LearnCourse | null> {
  try {
    await connectDB()
    
    const { Lesson } = await import("@/lib/db/models")
    
    const course = await Course.findById(courseId)
      .populate("instructor", "firstName lastName avatarUrl")
      .lean()
    
    if (!course) return null
    
    const instructor = course.instructor as unknown as {
      firstName: string
      lastName: string
      avatarUrl: string
    }
    
    const lessons = await Lesson.find({ course: courseId })
      .sort({ order: 1 })
      .lean()
    
    return {
      id: course._id.toString(),
      title: course.title,
      instructorName: `${instructor.firstName} ${instructor.lastName}`,
      instructorAvatarUrl: instructor.avatarUrl,
      rating: course.rating?.average || null,
      lessons: lessons.map((l) => ({
        id: l._id.toString(),
        courseId: courseId,
        title: l.title,
        description: l.description || "",
        type: l.type as "video" | "live" | "text",
        videoUrl: l.videoUrl || null,
        thumbnailUrl: l.videoThumbnailUrl || null,
        content: l.content || null,
        duration: l.videoDuration ? Math.round(l.videoDuration / 60) : null,
        order: l.order,
        isFree: l.isFree,
      })),
    }
  } catch (error) {
    console.error("Fetch course for learning error:", error)
    return null
  }
}

/**
 * Fetch other courses (for recommendations)
 */
export async function fetchOtherCourses(excludeCourseId: string): Promise<BrowseCourse[]> {
  try {
    await connectDB()
    
    const courses = await Course.find({
      _id: { $ne: excludeCourseId },
      status: "published",
    })
      .populate("instructor", "firstName lastName avatarUrl")
      .limit(6)
      .lean()
    
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
    console.error("Fetch other courses error:", error)
    return []
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
    const user = await getAuthenticatedUser()
    
    const { Lesson } = await import("@/lib/db/models")
    
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
    
    // Get first lesson for each enrolled course
    const results = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = enrollment.course as unknown as {
          _id: { toString(): string }
          title: string
          thumbnailUrl: string
          instructor: { firstName: string; lastName: string }
        }
        
        const firstLesson = await Lesson.findOne({ course: course._id })
          .sort({ order: 1 })
          .select("_id")
          .lean()
        
        return {
          id: enrollment._id.toString(),
          courseId: course._id.toString(),
          courseTitle: course.title,
          courseThumbnail: course.thumbnailUrl,
          instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
          progress: enrollment.progress,
          lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || new Date().toISOString(),
          status: enrollment.status,
          firstLessonId: firstLesson?._id.toString() || null,
        }
      })
    )
    
    return results
  } catch (error) {
    console.error("Fetch my enrollments error:", error)
    return []
  }
}

// ============================================================================
// BOOKMARKS
// ============================================================================


/**
 * Fetch user's bookmarked courses
 */
export async function fetchMyBookmarks(): Promise<StudentBookmark[]> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    
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
    const user = await getAuthenticatedUser()
    
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
    const user = await getAuthenticatedUser()
    
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

// ============================================================================
// LESSON COMPLETION
// ============================================================================

/**
 * Mark a lesson as completed
 */
export async function markLessonComplete(courseId: string, lessonId: string): Promise<{ success: boolean }> {
  "use server"
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    const { Lesson } = await import("@/lib/db/models")
    
    // Find or create enrollment
    let enrollment = await Enrollment.findOne({ user: user._id, course: courseId })
    
    if (!enrollment) {
      enrollment = await Enrollment.create({
        user: user._id,
        course: courseId,
        status: "active",
        progress: 0,
        completedLessons: [],
      })
    }
    
    // Add lesson to completed if not already there
    if (!enrollment.completedLessons.some((id: { toString(): string }) => id.toString() === lessonId)) {
      enrollment.completedLessons.push(new mongoose.Types.ObjectId(lessonId))
    }
    
    // Calculate progress
    const totalLessons = await Lesson.countDocuments({ course: courseId })
    enrollment.progress = Math.round((enrollment.completedLessons.length / totalLessons) * 100)
    enrollment.lastAccessedAt = new Date()
    
    await enrollment.save()
    
    return { success: true }
  } catch (error) {
    console.error("Mark lesson complete error:", error)
    return { success: false }
  }
}

/**
 * Get completed lesson IDs for a course
 */
export async function getCompletedLessons(courseId: string): Promise<string[]> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    
    const enrollment = await Enrollment.findOne({ user: user._id, course: courseId })
      .select("completedLessons")
      .lean()
    
    if (!enrollment) return []
    
    return enrollment.completedLessons.map((id: { toString(): string }) => id.toString())
  } catch (error) {
    console.error("Get completed lessons error:", error)
    return []
  }
}

/**
 * Mark a course as completed
 */
export async function markCourseComplete(courseId: string): Promise<{ success: boolean }> {
  "use server"
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    const { Lesson } = await import("@/lib/db/models")
    
    // Find or create enrollment
    let enrollment = await Enrollment.findOne({ user: user._id, course: courseId })
    
    if (!enrollment) {
      enrollment = await Enrollment.create({
        user: user._id,
        course: courseId,
        status: "completed",
        progress: 100,
        completedLessons: [],
        completedAt: new Date(),
      })
    } else {
      enrollment.status = "completed"
      enrollment.progress = 100
      enrollment.completedAt = new Date()
      enrollment.lastAccessedAt = new Date()
      await enrollment.save()
    }
    
    return { success: true }
  } catch (error) {
    console.error("Mark course complete error:", error)
    return { success: false }
  }
}

// ============================================================================
// INSTRUCTOR PUBLIC PROFILE
// ============================================================================

export type InstructorPublicProfile = {
  id: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string | null
  bio: string | null
  headline: string | null
  expertise: string[]
  socialLinks: {
    twitter?: string
    linkedin?: string
    website?: string
  }
  totalStudents: number
  totalCourses: number
  createdAt: string
}

export type InstructorCourse = {
  id: string
  title: string
  thumbnailUrl: string | null
  level: "beginner" | "intermediate" | "advanced"
  pricing: "free" | "paid"
  price: number | null
  totalLessons: number
  enrolledCount: number
  rating: number | null
}

/**
 * Fetch instructor public profile by ID
 */
export async function fetchInstructorProfile(instructorId: string): Promise<InstructorPublicProfile | null> {
  try {
    await connectDB()
    
    const instructor = await User.findById(instructorId)
      .select("firstName lastName avatarUrl bio role instructorProfile createdAt")
      .lean()
    
    if (!instructor) return null
    
    // Compute real counts from DB
    const [courseCount, studentCount] = await Promise.all([
      Course.countDocuments({ instructor: instructor._id, status: "published" }),
      Enrollment.distinct("user", {
        course: { $in: await Course.find({ instructor: instructor._id }).distinct("_id") },
      }).then((ids) => ids.length),
    ])
    
    return {
      id: instructor._id.toString(),
      firstName: instructor.firstName,
      lastName: instructor.lastName || "",
      fullName: `${instructor.firstName} ${instructor.lastName || ""}`.trim(),
      avatarUrl: instructor.avatarUrl,
      bio: instructor.bio,
      headline: instructor.instructorProfile?.headline || null,
      expertise: instructor.instructorProfile?.expertise || [],
      socialLinks: instructor.instructorProfile?.socialLinks || {},
      totalStudents: studentCount,
      totalCourses: courseCount,
      createdAt: instructor.createdAt.toISOString(),
    }
  } catch (error) {
    console.error("Fetch instructor profile error:", error)
    return null
  }
}

/**
 * Fetch all published courses by an instructor
 */
export async function fetchInstructorPublicCourses(instructorId: string): Promise<InstructorCourse[]> {
  try {
    await connectDB()
    
    const courses = await Course.find({
      instructor: instructorId,
      status: "published",
    })
      .select("title thumbnailUrl level pricing price totalLessons enrolledCount rating")
      .sort({ createdAt: -1 })
      .lean()
    
    return courses.map((course) => ({
      id: course._id.toString(),
      title: course.title,
      thumbnailUrl: course.thumbnailUrl,
      level: course.level as "beginner" | "intermediate" | "advanced",
      pricing: course.pricing as "free" | "paid",
      price: course.price,
      totalLessons: course.totalLessons || 0,
      enrolledCount: course.enrolledCount || 0,
      rating: course.rating?.average || null,
    }))
  } catch (error) {
    console.error("Fetch instructor courses error:", error)
    return []
  }
}

/**
 * Fetch courses from an instructor that the current user is enrolled in
 */
export async function fetchEnrolledCoursesFromInstructor(instructorId: string): Promise<InstructorCourse[]> {
  try {
    await connectDB()
    const user = await getAuthenticatedUser()
    
    // Get user's enrollments
    const enrollments = await Enrollment.find({ user: user._id })
      .select("course")
      .lean()
    
    const enrolledCourseIds = enrollments.map((e) => e.course.toString())
    
    // Get courses from this instructor that user is enrolled in
    const courses = await Course.find({
      _id: { $in: enrolledCourseIds },
      instructor: instructorId,
    })
      .select("title thumbnailUrl level pricing price totalLessons enrolledCount rating")
      .lean()
    
    return courses.map((course) => ({
      id: course._id.toString(),
      title: course.title,
      thumbnailUrl: course.thumbnailUrl,
      level: course.level as "beginner" | "intermediate" | "advanced",
      pricing: course.pricing as "free" | "paid",
      price: course.price,
      totalLessons: course.totalLessons || 0,
      enrolledCount: course.enrolledCount || 0,
      rating: course.rating?.average || null,
    }))
  } catch (error) {
    console.error("Fetch enrolled courses from instructor error:", error)
    return []
  }
}
