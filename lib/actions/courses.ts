"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/db"
import { Course, ICourse, Lesson, User } from "@/lib/db/models"
import { uploadThumbnail, deleteFromCloudinary } from "@/lib/cloudinary"
import { z } from "zod/v4"
import { Types } from "mongoose"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const CreateCourseSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(20),
  shortDescription: z.string().max(200).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  pricing: z.enum(["free", "paid"]),
  price: z.number().min(0).optional(),
  category: z.string().min(2),
  tags: z.array(z.string()).optional(),
  whatYouWillLearn: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  targetAudience: z.array(z.string()).optional(),
})

const UpdateCourseSchema = CreateCourseSchema.partial()

// ============================================================================
// TYPES
// ============================================================================

export type CourseWithInstructor = ICourse & {
  instructor: {
    _id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
    instructorProfile?: {
      headline: string | null
      totalStudents: number
      totalCourses: number
    }
  }
}

export type CourseListItem = {
  id: string
  title: string
  slug: string
  shortDescription: string | null
  thumbnailUrl: string | null
  level: string
  pricing: string
  price: number
  status: string
  totalLessons: number
  totalDuration: number
  enrolledCount: number
  rating: number
  ratingCount: number
  instructorName: string
  instructorAvatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// COURSE ACTIONS
// ============================================================================

/**
 * Create a new course (Instructor only)
 */
export async function createCourse(
  instructorId: string,
  data: z.infer<typeof CreateCourseSchema>
) {
  try {
    await connectDB()

    // Validate input
    const validated = CreateCourseSchema.parse(data)

    // Check instructor exists
    const instructor = await User.findById(instructorId)
    if (!instructor || !["INSTRUCTOR", "ADMIN"].includes(instructor.role)) {
      return { success: false, error: "Unauthorized" }
    }

    // Create course
    const course = await Course.create({
      ...validated,
      instructor: new Types.ObjectId(instructorId),
      price: validated.pricing === "free" ? 0 : (validated.price || 0),
    })

    // Update instructor stats
    await User.findByIdAndUpdate(instructorId, {
      $inc: { "instructorProfile.totalCourses": 1 },
    })

    revalidatePath("/instructor/courses")

    return {
      success: true,
      data: {
        id: course._id.toString(),
        slug: course.slug,
      },
    }
  } catch (error) {
    console.error("Create course error:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid input data", details: error.issues }
    }
    return { success: false, error: "Failed to create course" }
  }
}

/**
 * Update course details
 */
export async function updateCourse(
  courseId: string,
  instructorId: string,
  data: z.infer<typeof UpdateCourseSchema>
) {
  try {
    await connectDB()

    const validated = UpdateCourseSchema.parse(data)

    // Find course and verify ownership
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    })

    if (!course) {
      return { success: false, error: "Course not found or unauthorized" }
    }

    // Update course
    Object.assign(course, validated)
    if (validated.pricing === "free") {
      course.price = 0
    }
    await course.save()

    revalidatePath(`/instructor/courses/${courseId}`)
    revalidatePath(`/instructor/courses/${courseId}/edit`)

    return { success: true, data: { id: course._id.toString() } }
  } catch (error) {
    console.error("Update course error:", error)
    return { success: false, error: "Failed to update course" }
  }
}

/**
 * Upload course thumbnail
 */
export async function uploadCourseThumbnail(
  courseId: string,
  instructorId: string,
  file: string // Base64 string
) {
  try {
    await connectDB()

    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    })

    if (!course) {
      return { success: false, error: "Course not found or unauthorized" }
    }

    // Delete old thumbnail if exists
    if (course.thumbnailUrl) {
      // Extract public ID from URL and delete
      const publicId = course.thumbnailUrl
        .split("/")
        .slice(-2)
        .join("/")
        .replace(/\.[^/.]+$/, "")
      await deleteFromCloudinary(publicId)
    }

    // Upload new thumbnail
    const result = await uploadThumbnail(file)

    // Update course
    course.thumbnailUrl = result.url
    await course.save()

    revalidatePath(`/instructor/courses/${courseId}`)

    return { success: true, data: { url: result.url } }
  } catch (error) {
    console.error("Upload thumbnail error:", error)
    return { success: false, error: "Failed to upload thumbnail" }
  }
}

/**
 * Publish a course
 */
export async function publishCourse(courseId: string, instructorId: string) {
  try {
    await connectDB()

    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    })

    if (!course) {
      return { success: false, error: "Course not found or unauthorized" }
    }

    // Check if course has lessons
    const lessonCount = await Lesson.countDocuments({
      course: courseId,
      isPublished: true,
    })

    if (lessonCount === 0) {
      return { success: false, error: "Course must have at least one published lesson" }
    }

    // Publish
    course.status = "published"
    course.publishedAt = new Date()
    await course.save()

    revalidatePath(`/instructor/courses/${courseId}`)
    revalidatePath("/instructor/courses")
    revalidatePath("/dashboard/courses")

    return { success: true }
  } catch (error) {
    console.error("Publish course error:", error)
    return { success: false, error: "Failed to publish course" }
  }
}

/**
 * Archive a course
 */
export async function archiveCourse(courseId: string, instructorId: string) {
  try {
    await connectDB()

    const course = await Course.findOneAndUpdate(
      { _id: courseId, instructor: instructorId },
      { status: "archived" },
      { new: true }
    )

    if (!course) {
      return { success: false, error: "Course not found or unauthorized" }
    }

    revalidatePath(`/instructor/courses/${courseId}`)
    revalidatePath("/instructor/courses")

    return { success: true }
  } catch (error) {
    console.error("Archive course error:", error)
    return { success: false, error: "Failed to archive course" }
  }
}

/**
 * Delete a course (soft delete by archiving, or hard delete if draft)
 */
export async function deleteCourse(courseId: string, instructorId: string) {
  try {
    await connectDB()

    const course = await Course.findOne({
      _id: courseId,
      instructor: instructorId,
    })

    if (!course) {
      return { success: false, error: "Course not found or unauthorized" }
    }

    // If draft, delete completely
    if (course.status === "draft") {
      // Delete all lessons
      await Lesson.deleteMany({ course: courseId })
      // Delete course
      await course.deleteOne()
      // Update instructor stats
      await User.findByIdAndUpdate(instructorId, {
        $inc: { "instructorProfile.totalCourses": -1 },
      })
    } else {
      // Just archive
      course.status = "archived"
      await course.save()
    }

    revalidatePath("/instructor/courses")

    return { success: true }
  } catch (error) {
    console.error("Delete course error:", error)
    return { success: false, error: "Failed to delete course" }
  }
}

// ============================================================================
// COURSE QUERIES
// ============================================================================

/**
 * Get courses for instructor dashboard
 */
export async function getInstructorCourses(
  instructorId: string,
  options?: {
    status?: "draft" | "published" | "archived" | "all"
    page?: number
    limit?: number
  }
): Promise<{ courses: CourseListItem[]; total: number }> {
  try {
    await connectDB()

    const { status = "all", page = 1, limit = 10 } = options || {}

    const query: Record<string, unknown> = { instructor: instructorId }
    if (status !== "all") {
      query.status = status
    }

    const [courses, total] = await Promise.all([
      Course.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("instructor", "firstName lastName avatarUrl")
        .lean(),
      Course.countDocuments(query),
    ])

    return {
      courses: courses.map((course) => ({
        id: course._id.toString(),
        title: course.title,
        slug: course.slug,
        shortDescription: course.shortDescription,
        thumbnailUrl: course.thumbnailUrl,
        level: course.level,
        pricing: course.pricing,
        price: course.price,
        status: course.status,
        totalLessons: course.totalLessons,
        totalDuration: course.totalDuration,
        enrolledCount: course.enrolledCount,
        rating: course.rating.average,
        ratingCount: course.rating.count,
        instructorName: `${(course.instructor as unknown as { firstName: string; lastName: string }).firstName} ${(course.instructor as unknown as { firstName: string; lastName: string }).lastName}`,
        instructorAvatarUrl: (course.instructor as unknown as { avatarUrl: string | null }).avatarUrl,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      })),
      total,
    }
  } catch (error) {
    console.error("Get instructor courses error:", error)
    return { courses: [], total: 0 }
  }
}

/**
 * Get a single course by ID (for editing)
 */
export async function getCourseById(courseId: string) {
  try {
    await connectDB()

    const course = await Course.findById(courseId)
      .populate("instructor", "firstName lastName avatarUrl instructorProfile")
      .lean()

    if (!course) {
      return null
    }

    return {
      id: course._id.toString(),
      title: course.title,
      slug: course.slug,
      description: course.description,
      shortDescription: course.shortDescription,
      thumbnailUrl: course.thumbnailUrl,
      previewVideoUrl: course.previewVideoUrl,
      level: course.level,
      pricing: course.pricing,
      price: course.price,
      currency: course.currency,
      status: course.status,
      category: course.category,
      tags: course.tags,
      totalLessons: course.totalLessons,
      totalDuration: course.totalDuration,
      enrolledCount: course.enrolledCount,
      rating: course.rating,
      whatYouWillLearn: course.whatYouWillLearn,
      requirements: course.requirements,
      targetAudience: course.targetAudience,
      publishedAt: course.publishedAt,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      instructor: {
        id: (course.instructor as unknown as { _id: Types.ObjectId })._id.toString(),
        firstName: (course.instructor as unknown as { firstName: string }).firstName,
        lastName: (course.instructor as unknown as { lastName: string }).lastName,
        avatarUrl: (course.instructor as unknown as { avatarUrl: string | null }).avatarUrl,
        instructorProfile: (course.instructor as unknown as { instructorProfile?: object }).instructorProfile,
      },
    }
  } catch (error) {
    console.error("Get course by ID error:", error)
    return null
  }
}

/**
 * Get published courses for students (browse)
 */
export async function getPublishedCourses(options?: {
  level?: string
  pricing?: string
  category?: string
  search?: string
  sortBy?: "popular" | "newest" | "rating" | "price-low" | "price-high"
  page?: number
  limit?: number
}): Promise<{ courses: CourseListItem[]; total: number }> {
  try {
    await connectDB()

    const {
      level,
      pricing,
      category,
      search,
      sortBy = "popular",
      page = 1,
      limit = 12,
    } = options || {}

    const query: Record<string, unknown> = { status: "published" }

    if (level && level !== "all") {
      query.level = level.toLowerCase()
    }
    if (pricing && pricing !== "all") {
      query.pricing = pricing.toLowerCase()
    }
    if (category) {
      query.category = category
    }
    if (search) {
      query.$text = { $search: search }
    }

    // Sorting
    let sort: Record<string, 1 | -1> = { enrolledCount: -1 }
    switch (sortBy) {
      case "newest":
        sort = { publishedAt: -1 }
        break
      case "rating":
        sort = { "rating.average": -1 }
        break
      case "price-low":
        sort = { price: 1 }
        break
      case "price-high":
        sort = { price: -1 }
        break
    }

    const [courses, total] = await Promise.all([
      Course.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("instructor", "firstName lastName avatarUrl")
        .lean(),
      Course.countDocuments(query),
    ])

    return {
      courses: courses.map((course) => ({
        id: course._id.toString(),
        title: course.title,
        slug: course.slug,
        shortDescription: course.shortDescription,
        thumbnailUrl: course.thumbnailUrl,
        level: course.level,
        pricing: course.pricing,
        price: course.price,
        status: course.status,
        totalLessons: course.totalLessons,
        totalDuration: course.totalDuration,
        enrolledCount: course.enrolledCount,
        rating: course.rating.average,
        ratingCount: course.rating.count,
        instructorName: `${(course.instructor as unknown as { firstName: string; lastName: string }).firstName} ${(course.instructor as unknown as { firstName: string; lastName: string }).lastName}`,
        instructorAvatarUrl: (course.instructor as unknown as { avatarUrl: string | null }).avatarUrl,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      })),
      total,
    }
  } catch (error) {
    console.error("Get published courses error:", error)
    return { courses: [], total: 0 }
  }
}
