"use server"

import { Course, Enrollment, Lesson } from "@/lib/db/models"
import { Types } from "mongoose"
import { initAction, type Doc } from "./helpers"

export async function vividSearchCourses(p: {
  search?: string
  level?: string
  pricing?: string
  category?: string
  sortBy?: string
  limit?: number
}) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, courses: [], error: "Not authenticated" }

    const query: Doc = { status: "published" }
    if (p.search) query.$or = [
      { title: { $regex: p.search, $options: "i" } },
      { description: { $regex: p.search, $options: "i" } },
      { tags: { $regex: p.search, $options: "i" } },
    ]
    if (p.level) query.level = p.level
    if (p.pricing) query.pricing = p.pricing
    if (p.category) query.category = p.category

    let sort: Doc = { enrolledCount: -1 }
    if (p.sortBy === "newest") sort = { createdAt: -1 }
    else if (p.sortBy === "rating") sort = { "rating.average": -1 }
    else if (p.sortBy === "price-low") sort = { price: 1 }
    else if (p.sortBy === "price-high") sort = { price: -1 }

    const courses = await Course.find(query)
      .populate("instructor", "firstName lastName avatarUrl")
      .sort(sort)
      .limit(p.limit || 8)
      .lean()

    return {
      success: true,
      courses: courses.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        slug: c.slug,
        shortDescription: c.shortDescription,
        thumbnailUrl: c.thumbnailUrl,
        level: c.level,
        pricing: c.pricing,
        price: c.price,
        enrolledCount: c.enrolledCount,
        rating: c.rating?.average || 0,
        totalLessons: c.totalLessons,
        instructorName: `${(c.instructor as Doc)?.firstName || ""} ${(c.instructor as Doc)?.lastName || ""}`.trim(),
        instructorAvatar: (c.instructor as Doc)?.avatarUrl || null,
      })),
    }
  } catch (error) {
    console.error("[Vivid] searchCourses error:", error)
    return { success: false, courses: [], error: "Failed to search courses" }
  }
}

export async function vividGetCourseDetails(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const course = await Course.findById(p.courseId)
      .populate("instructor", "firstName lastName avatarUrl bio")
      .lean()

    if (!course) return { success: false, error: "Course not found" }

    const lessonCount = await Lesson.countDocuments({ course: course._id, isPublished: true })

    const enrollment = await Enrollment.findOne({
      user: currentUser.id,
      course: course._id,
    }).lean()

    const firstLesson = await Lesson.findOne({ course: course._id, isPublished: true })
      .sort({ order: 1 })
      .select("_id")
      .lean()

    return {
      success: true,
      course: {
        id: course._id.toString(),
        title: course.title,
        slug: course.slug,
        shortDescription: course.shortDescription,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        level: course.level,
        pricing: course.pricing,
        price: course.price,
        enrolledCount: course.enrolledCount,
        rating: course.rating?.average || 0,
        ratingCount: course.rating?.count || 0,
        totalLessons: lessonCount,
        totalDuration: course.totalDuration,
        whatYouWillLearn: course.whatYouWillLearn,
        requirements: course.requirements,
        category: course.category,
        instructorName: `${(course.instructor as Doc)?.firstName || ""} ${(course.instructor as Doc)?.lastName || ""}`.trim(),
        instructorAvatar: (course.instructor as Doc)?.avatarUrl,
        isEnrolled: !!enrollment,
        enrollmentStatus: enrollment?.status,
        enrollmentProgress: enrollment?.progress || 0,
        firstLessonId: firstLesson?._id?.toString(),
      },
    }
  } catch (error) {
    console.error("[Vivid] getCourseDetails error:", error)
    return { success: false, error: "Failed to get course details" }
  }
}

export async function vividGetCourseLessons(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const lessons = await Lesson.find({ course: p.courseId, isPublished: true })
      .sort({ order: 1 })
      .select("_id title order videoDuration")
      .lean()

    const enrollment = await Enrollment.findOne({ user: currentUser.id, course: p.courseId })
      .select("completedLessons")
      .lean()

    const completedIds = new Set((enrollment?.completedLessons || []).map((id: Types.ObjectId) => id.toString()))

    return {
      success: true,
      courseId: p.courseId,
      lessons: lessons.map((l, i) => ({
        id: l._id.toString(),
        title: l.title,
        order: l.order || i + 1,
        duration: l.videoDuration,
        isCompleted: completedIds.has(l._id.toString()),
      })),
    }
  } catch (error) {
    console.error("[Vivid] getCourseLessons error:", error)
    return { success: false, error: "Failed to get lessons" }
  }
}

export async function vividGetUserEnrollments(p: { status?: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, enrollments: [], error: "Not authenticated" }

    const query: Doc = { user: currentUser.id }
    if (p.status && p.status !== "all") query.status = p.status

    const enrollments = await Enrollment.find(query)
      .populate({ path: "course", populate: { path: "instructor", select: "firstName lastName" } })
      .sort({ lastAccessedAt: -1 })
      .limit(10)
      .lean()

    return {
      success: true,
      enrollments: enrollments.map((e) => {
        const course = e.course as Doc
        return {
          id: e._id.toString(),
          courseId: course?._id?.toString(),
          courseTitle: course?.title || "Unknown",
          courseThumbnail: course?.thumbnailUrl,
          instructorName: course?.instructor
            ? `${course.instructor.firstName} ${course.instructor.lastName}`.trim()
            : "Unknown",
          progress: e.progress,
          completedLessons: e.completedLessons?.length || 0,
          totalLessons: course?.totalLessons || 0,
          status: e.status,
          lastAccessedAt: e.lastAccessedAt?.toISOString(),
        }
      }),
    }
  } catch (error) {
    console.error("[Vivid] getUserEnrollments error:", error)
    return { success: false, enrollments: [], error: "Failed to get enrollments" }
  }
}

export async function vividEnrollInCourse(p: { courseId: string }) {
  try {
    const currentUser = await initAction()
    if (!currentUser) return { success: false, error: "Not authenticated" }

    const course = await Course.findById(p.courseId).lean()
    if (!course) return { success: false, error: "Course not found" }

    const existing = await Enrollment.findOne({ user: currentUser.id, course: course._id })
    if (existing) return { success: true, already: true, message: "Already enrolled" }

    if (course.pricing === "free") {
      await Enrollment.create({
        user: currentUser.id,
        course: course._id,
        status: "active",
        progress: 0,
        completedLessons: [],
      })
      await Course.findByIdAndUpdate(course._id, { $inc: { enrolledCount: 1 } })
      return { success: true, enrolled: true, message: "Enrolled successfully!" }
    }

    return {
      success: true,
      needsCheckout: true,
      checkoutUrl: `/dashboard/checkout?courseId=${course._id}`,
      price: course.price,
      message: `This course costs $${course.price}. Redirecting to checkout.`,
    }
  } catch (error) {
    console.error("[Vivid] enrollInCourse error:", error)
    return { success: false, error: "Failed to enroll" }
  }
}
