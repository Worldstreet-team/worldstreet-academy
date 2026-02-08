"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import connectDB from "@/lib/db"
import { Course, Lesson, User, ICourse } from "@/lib/db/models"
import { uploadThumbnail, deleteFromCloudinary } from "@/lib/cloudinary"
import type { CourseLevel, CoursePricing, CourseStatus, CourseCategory } from "@/lib/types"
import { getCurrentUser } from "@/lib/auth"

// ---- Types for form state ----
export type CourseFormState = {
  success: boolean
  error: string | null
  fieldErrors: Record<string, string>
}

// ---- Types for instructor courses ----
export type InstructorCourseItem = {
  id: string
  title: string
  thumbnailUrl: string | null
  status: string
  level: string
  pricing: string
  price: number | null
  totalLessons: number
  totalDuration: number
  enrolledCount: number
  rating: number | null
  createdAt: string
}


// ---- Generate slug from title ----
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    + "-" + Date.now().toString(36)
}

// ---- Get authenticated user (any user can be instructor) ----
async function getAuthenticatedInstructor() {
  const authUser = await getCurrentUser()
  
  if (!authUser) {
    throw new Error("Not authenticated")
  }
  
  // Allow any authenticated user to be an instructor
  // They can create and manage their own courses
  
  await connectDB()
  const instructor = await User.findById(authUser.id)
  
  if (!instructor) {
    throw new Error("User not found in database")
  }
  
  return instructor
}

// ---- Fetch Instructor Courses ----
export async function fetchInstructorCourses(): Promise<InstructorCourseItem[]> {
  try {
    await connectDB()
    const instructor = await getAuthenticatedInstructor()
    
    const courses = await Course.find({ instructor: instructor._id })
      .sort({ createdAt: -1 })
      .lean()
    
    return courses.map((course) => ({
      id: course._id.toString(),
      title: course.title,
      thumbnailUrl: course.thumbnailUrl,
      status: course.status,
      level: course.level,
      pricing: course.pricing,
      price: course.price,
      totalLessons: course.totalLessons || 0,
      totalDuration: course.totalDuration || 0,
      enrolledCount: course.enrolledCount || 0,
      rating: course.rating?.average || null,
      createdAt: course.createdAt.toISOString(),
    }))
  } catch (error) {
    console.error("Fetch instructor courses error:", error)
    return []
  }
}

// ---- Fetch Single Course for Editing ----
export async function fetchCourseForEdit(courseId: string) {
  try {
    await connectDB()
    const instructor = await getAuthenticatedInstructor()
    
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructor._id,
    }).lean()
    
    if (!course) return null
    
    const lessons = await Lesson.find({ course: courseId })
      .sort({ order: 1 })
      .lean()
    
    return {
      course: {
        id: course._id.toString(),
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        level: course.level as CourseLevel,
        pricing: course.pricing as CoursePricing,
        price: course.price,
        status: course.status as CourseStatus,
        category: (course.category || "Cryptocurrency") as CourseCategory,
      },
      lessons: lessons.map((l) => ({
        id: l._id.toString(),
        title: l.title,
        description: l.description,
        type: l.type,
        videoUrl: l.videoUrl,
        content: l.content,
        thumbnailUrl: l.videoThumbnailUrl || "",
        duration: l.videoDuration ?? null,
        isFree: l.isFree,
      })),
    }
  } catch (error) {
    console.error("Fetch course for edit error:", error)
    return null
  }
}

// ---- Create Course ----
export async function createCourse(
  _prevState: CourseFormState,
  formData: FormData
): Promise<CourseFormState> {
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const thumbnailUrl = formData.get("thumbnailUrl") as string
  const level = formData.get("level") as CourseLevel
  const pricing = formData.get("pricing") as CoursePricing
  const price = formData.get("price") as string
  const status = formData.get("status") as CourseStatus
  const category = formData.get("category") as string
  const lessonsJson = formData.get("lessons") as string

  // Validate
  const fieldErrors: Record<string, string> = {}

  if (!title || title.trim().length < 3) {
    fieldErrors.title = "Title must be at least 3 characters"
  }
  if (!description || description.trim().length < 10) {
    fieldErrors.description = "Description must be at least 10 characters"
  }
  if (!level) {
    fieldErrors.level = "Please select a level"
  }
  if (pricing === "paid" && (!price || parseFloat(price) <= 0)) {
    fieldErrors.price = "Please enter a valid price"
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: null, fieldErrors }
  }

  try {
    await connectDB()
    const instructor = await getAuthenticatedInstructor()
    
    // Create the course
    const course = await Course.create({
      title,
      slug: generateSlug(title),
      description,
      thumbnailUrl: thumbnailUrl || null,
      instructor: instructor._id,
      level,
      pricing,
      price: pricing === "paid" ? parseFloat(price) : 0,
      status: status || "draft",
      category: category || "Cryptocurrency",
    })
    
    // Create lessons if provided
    if (lessonsJson) {
      try {
        const lessons = JSON.parse(lessonsJson)
        console.log("[Create Course] Parsed lessons:", lessons)
        if (Array.isArray(lessons) && lessons.length > 0) {
          await Lesson.insertMany(
            lessons.map((l: { title: string; description?: string; type?: string; thumbnailUrl?: string; videoUrl?: string; content?: string; duration?: string; isFree?: boolean }, idx: number) => ({
              course: course._id,
              title: l.title,
              description: l.description || null,
              type: l.type || "video",
              videoUrl: l.videoUrl || null,
              videoThumbnailUrl: l.thumbnailUrl || null,
              content: l.content || null,
              videoDuration: l.duration ? parseInt(l.duration) : null,
              isFree: l.isFree || false,
              order: idx,
              isPublished: status === "published",
            }))
          )

          // Calculate total duration in minutes
          const totalDurationSecs = lessons.reduce((sum: number, l: { duration?: string }) => sum + (l.duration ? parseInt(l.duration) : 0), 0)
          
          // Update course lesson count and duration
          await Course.findByIdAndUpdate(course._id, {
            totalLessons: lessons.length,
            totalDuration: Math.ceil(totalDurationSecs / 60),
          })
        } else {
          console.log("[Create Course] No lessons to create (empty array or not an array)")
        }
      } catch (err) {
        console.error("Failed to parse lessons JSON:", err)
        console.error("Lessons JSON value:", lessonsJson)
      }
    } else {
      console.log("[Create Course] No lessons JSON provided")
    }
    
    // Update instructor course count
    await User.findByIdAndUpdate(instructor._id, {
      $inc: { "instructorProfile.totalCourses": 1 },
    })

    revalidatePath("/instructor/courses")
  } catch (error) {
    console.error("Create course error:", error)
    return { success: false, error: "Failed to create course", fieldErrors: {} }
  }

  redirect("/instructor/courses")
}

// ---- Update Course ----
export async function updateCourse(
  _prevState: CourseFormState,
  formData: FormData
): Promise<CourseFormState> {
  const courseId = formData.get("courseId") as string
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const thumbnailUrl = formData.get("thumbnailUrl") as string
  const level = formData.get("level") as CourseLevel
  const pricing = formData.get("pricing") as CoursePricing
  const price = formData.get("price") as string
  const status = formData.get("status") as CourseStatus
  const category = formData.get("category") as string
  const lessonsJson = formData.get("lessons") as string

  const fieldErrors: Record<string, string> = {}

  if (!title || title.trim().length < 3) {
    fieldErrors.title = "Title must be at least 3 characters"
  }
  if (!description || description.trim().length < 10) {
    fieldErrors.description = "Description must be at least 10 characters"
  }
  if (pricing === "paid" && (!price || parseFloat(price) <= 0)) {
    fieldErrors.price = "Please enter a valid price"
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: null, fieldErrors }
  }

  try {
    await connectDB()
    const instructor = await getAuthenticatedInstructor()
    
    // Verify ownership
    const existingCourse = await Course.findOne({
      _id: courseId,
      instructor: instructor._id,
    })
    
    if (!existingCourse) {
      return { success: false, error: "Course not found", fieldErrors: {} }
    }
    
    // Update course
    await Course.findByIdAndUpdate(courseId, {
      title,
      description,
      thumbnailUrl: thumbnailUrl || null,
      level,
      pricing,
      price: pricing === "paid" ? parseFloat(price) : 0,
      status,
      category: category || existingCourse.category,
    })
    
    // Update lessons if provided
    if (lessonsJson) {
      try {
        const lessons = JSON.parse(lessonsJson)
        console.log("[Update Course] Parsed lessons:", lessons)
        if (Array.isArray(lessons)) {
          // Delete existing lessons and recreate (simple approach)
          await Lesson.deleteMany({ course: courseId })
          
          if (lessons.length > 0) {
            await Lesson.insertMany(
              lessons.map((l: { tempId?: string; title: string; description?: string; type?: string; thumbnailUrl?: string; videoUrl?: string; content?: string; duration?: string; isFree?: boolean }, idx: number) => ({
                course: courseId,
                title: l.title,
                description: l.description || null,
                type: l.type || "video",
                videoUrl: l.videoUrl || null,
                videoThumbnailUrl: l.thumbnailUrl || null,
                content: l.content || null,
                videoDuration: l.duration ? parseInt(l.duration) : null,
                isFree: l.isFree || false,
                order: idx,
                isPublished: status === "published",
              }))
            )
          }

          // Calculate total duration in minutes
          const totalDurationSecs = lessons.reduce((sum: number, l: { duration?: string }) => sum + (l.duration ? parseInt(l.duration) : 0), 0)
          
          // Update course lesson count and duration
          await Course.findByIdAndUpdate(courseId, {
            totalLessons: lessons.length,
            totalDuration: Math.ceil(totalDurationSecs / 60),
          })
        } else {
          console.log("[Update Course] Lessons is not an array")
        }
      } catch (err) {
        console.error("Failed to parse lessons JSON:", err)
        console.error("Lessons JSON value:", lessonsJson)
      }
    } else {
      console.log("[Update Course] No lessons JSON provided")
    }

    revalidatePath("/instructor/courses")
    revalidatePath(`/instructor/courses/${courseId}/edit`)
  } catch (error) {
    console.error("Update course error:", error)
    return { success: false, error: "Failed to update course", fieldErrors: {} }
  }

  redirect("/instructor/courses")
}

// ---- Delete Course ----
export async function deleteCourse(formData: FormData): Promise<void> {
  const courseId = formData.get("courseId") as string

  try {
    await connectDB()
    const instructor = await getAuthenticatedInstructor()
    
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructor._id,
    })
    
    if (!course) {
      // Just redirect without error for form action
      redirect("/instructor/courses")
    }
    
    // Delete thumbnail from Cloudinary if exists
    if (course.thumbnailPublicId) {
      await deleteFromCloudinary(course.thumbnailPublicId, "image")
    }
    
    // Delete all lessons (and their videos)
    const lessons = await Lesson.find({ course: courseId })
    for (const lesson of lessons) {
      if (lesson.videoPublicId) {
        await deleteFromCloudinary(lesson.videoPublicId, "video")
      }
    }
    await Lesson.deleteMany({ course: courseId })
    
    // Delete course
    await course.deleteOne()
    
    // Update instructor course count
    await User.findByIdAndUpdate(instructor._id, {
      $inc: { "instructorProfile.totalCourses": -1 },
    })

    revalidatePath("/instructor/courses")
  } catch (error) {
    console.error("Delete course error:", error)
  }

  redirect("/instructor/courses")
}

// ---- Add Lesson ----
export async function addLesson(
  _prevState: CourseFormState,
  formData: FormData
): Promise<CourseFormState> {
  const courseId = formData.get("courseId") as string
  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const type = formData.get("type") as string
  const videoUrl = formData.get("videoUrl") as string
  const content = formData.get("content") as string
  const duration = formData.get("duration") as string
  const isFree = formData.get("isFree") === "true"

  const fieldErrors: Record<string, string> = {}

  if (!title || title.trim().length < 2) {
    fieldErrors.title = "Title is required"
  }
  if (type === "video" && !videoUrl) {
    fieldErrors.videoUrl = "Video URL is required for video lessons"
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: null, fieldErrors }
  }

  try {
    await connectDB()
    const instructor = await getAuthenticatedInstructor()
    
    // Verify ownership
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructor._id,
    })
    
    if (!course) {
      return { success: false, error: "Course not found", fieldErrors: {} }
    }
    
    // Get next order
    const lastLesson = await Lesson.findOne({ course: courseId })
      .sort({ order: -1 })
      .select("order")
    const order = lastLesson ? lastLesson.order + 1 : 0
    
    // Create lesson
    await Lesson.create({
      course: courseId,
      title,
      description: description || null,
      type: type || "video",
      videoUrl: type === "video" ? videoUrl : null,
      content: null,
      videoDuration: duration ? parseInt(duration) * 60 : null,
      isFree,
      order,
      isPublished: course.status === "published",
    })
    
    // Update course lesson count
    const totalLessons = await Lesson.countDocuments({ course: courseId })
    await Course.findByIdAndUpdate(courseId, { totalLessons })

    revalidatePath(`/instructor/courses/${courseId}/lessons`)
    return { success: true, error: null, fieldErrors: {} }
  } catch (error) {
    console.error("Add lesson error:", error)
    return { success: false, error: "Failed to add lesson", fieldErrors: {} }
  }
}

// ---- Delete Lesson ----
export async function deleteLesson(formData: FormData): Promise<void> {
  const courseId = formData.get("courseId") as string
  const lessonId = formData.get("lessonId") as string

  try {
    await connectDB()
    const instructor = await getAuthenticatedInstructor()
    
    // Verify ownership
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructor._id,
    })
    
    if (!course) {
      return // Just return without doing anything
    }
    
    const lesson = await Lesson.findOne({
      _id: lessonId,
      course: courseId,
    })
    
    if (lesson) {
      // Delete video from Cloudinary if exists
      if (lesson.videoPublicId) {
        await deleteFromCloudinary(lesson.videoPublicId, "video")
      }
      
      await lesson.deleteOne()
      
      // Update course lesson count
      const totalLessons = await Lesson.countDocuments({ course: courseId })
      await Course.findByIdAndUpdate(courseId, { totalLessons })
    }

    revalidatePath(`/instructor/courses/${courseId}/lessons`)
  } catch (error) {
    console.error("Delete lesson error:", error)
  }
}

// ---- Upload Course Thumbnail ----
export async function uploadCourseThumbnail(
  courseId: string,
  file: string // Base64 or URL
) {
  try {
    await connectDB()
    const instructor = await getAuthenticatedInstructor()
    
    const course = await Course.findOne({
      _id: courseId,
      instructor: instructor._id,
    })
    
    if (!course) {
      return { success: false, error: "Course not found" }
    }
    
    // Delete old thumbnail if exists
    if (course.thumbnailPublicId) {
      await deleteFromCloudinary(course.thumbnailPublicId, "image")
    }
    
    // Upload new thumbnail
    const result = await uploadThumbnail(file)
    
    // Update course
    course.thumbnailUrl = result.url
    course.thumbnailPublicId = result.publicId
    await course.save()
    
    revalidatePath("/instructor/courses")
    revalidatePath(`/instructor/courses/${courseId}/edit`)
    
    return { success: true, url: result.url }
  } catch (error) {
    console.error("Upload thumbnail error:", error)
    return { success: false, error: "Failed to upload thumbnail" }
  }
}
