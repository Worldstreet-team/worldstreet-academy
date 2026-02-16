"use server"

import { revalidatePath } from "next/cache"
import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Review, Course, Enrollment } from "@/lib/db/models"
import { z } from "zod/v4"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const CreateReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(3).max(100).optional(),
  content: z.string().min(10).max(2000).optional(),
})

const UpdateReviewSchema = CreateReviewSchema.partial()

// ============================================================================
// TYPES
// ============================================================================

export type ReviewItem = {
  id: string
  userId: string
  userName: string
  userAvatar: string | null
  rating: number
  title: string | null
  content: string | null
  createdAt: string
  isVerifiedPurchase: boolean
  helpfulCount: number
}

export type CourseRatingSummary = {
  average: number
  count: number
  distribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
}

// ============================================================================
// REVIEW ACTIONS
// ============================================================================

/**
 * Submit a review for a course
 */
export async function submitReview(
  userId: string,
  courseId: string,
  data: z.infer<typeof CreateReviewSchema>
) {
  try {
    await connectDB()

    const validated = CreateReviewSchema.parse(data)

    // Check if user is enrolled
    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })

    if (!enrollment) {
      return { success: false, error: "Must be enrolled to review" }
    }

    // Check if already reviewed
    const existing = await Review.findOne({
      user: userId,
      course: courseId,
    })

    if (existing) {
      return { success: false, error: "Already reviewed this course" }
    }

    // Create review
    const review = await Review.create({
      user: userId,
      course: courseId,
      ...validated,
      isApproved: true, // Auto-approve for now
    })

    // Update course rating
    await updateCourseRating(courseId)

    revalidatePath(`/courses/${courseId}`)

    return {
      success: true,
      data: { reviewId: review._id.toString() },
    }
  } catch (error) {
    console.error("Submit review error:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid input data" }
    }
    return { success: false, error: "Failed to submit review" }
  }
}

/**
 * Update existing review
 */
export async function updateReview(
  userId: string,
  reviewId: string,
  data: z.infer<typeof UpdateReviewSchema>
) {
  try {
    await connectDB()

    const validated = UpdateReviewSchema.parse(data)

    const review = await Review.findOne({
      _id: reviewId,
      user: userId,
    })

    if (!review) {
      return { success: false, error: "Review not found" }
    }

    Object.assign(review, validated)
    review.updatedAt = new Date()
    await review.save()

    // Update course rating if rating changed
    if (validated.rating) {
      await updateCourseRating(review.course.toString())
    }

    revalidatePath(`/courses/${review.course}`)

    return { success: true }
  } catch (error) {
    console.error("Update review error:", error)
    return { success: false, error: "Failed to update review" }
  }
}

/**
 * Delete review
 */
export async function deleteReview(userId: string, reviewId: string) {
  try {
    await connectDB()

    const review = await Review.findOne({
      _id: reviewId,
      user: userId,
    })

    if (!review) {
      return { success: false, error: "Review not found" }
    }

    const courseId = review.course.toString()
    await review.deleteOne()

    // Update course rating
    await updateCourseRating(courseId)

    revalidatePath(`/courses/${courseId}`)

    return { success: true }
  } catch (error) {
    console.error("Delete review error:", error)
    return { success: false, error: "Failed to delete review" }
  }
}

/**
 * Mark review as helpful
 */
export async function markReviewHelpful(reviewId: string) {
  try {
    await connectDB()

    await Review.findByIdAndUpdate(reviewId, {
      $inc: { helpfulCount: 1 },
    })

    return { success: true }
  } catch (error) {
    console.error("Mark helpful error:", error)
    return { success: false, error: "Failed to mark helpful" }
  }
}

/**
 * Report a review
 */
export async function reportReview(reviewId: string, reason: string) {
  try {
    await connectDB()

    await Review.findByIdAndUpdate(reviewId, {
      $inc: { reportCount: 1 },
      $push: { reports: { reason, reportedAt: new Date() } },
    })

    return { success: true }
  } catch (error) {
    console.error("Report review error:", error)
    return { success: false, error: "Failed to report review" }
  }
}

// ============================================================================
// REVIEW QUERIES
// ============================================================================

/**
 * Get reviews for a course
 */
export async function getCourseReviews(
  courseId: string,
  options: {
    page?: number
    limit?: number
    sortBy?: "recent" | "helpful" | "rating_high" | "rating_low"
  } = {}
): Promise<{ reviews: ReviewItem[]; total: number }> {
  try {
    await connectDB()

    const { page = 1, limit = 10, sortBy = "recent" } = options

    // Build sort
    let sort: Record<string, 1 | -1> = {}
    switch (sortBy) {
      case "helpful":
        sort = { helpfulCount: -1, createdAt: -1 }
        break
      case "rating_high":
        sort = { rating: -1, createdAt: -1 }
        break
      case "rating_low":
        sort = { rating: 1, createdAt: -1 }
        break
      default:
        sort = { createdAt: -1 }
    }

    const [reviews, total] = await Promise.all([
      Review.find({
        course: courseId,
        isApproved: true,
        isHidden: false,
      })
        .populate("user", "firstName lastName avatarUrl")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments({
        course: courseId,
        isApproved: true,
        isHidden: false,
      }),
    ])

    // Get enrollment info for verified purchase badges
    const userIds = reviews.map((r) => r.user._id)
    const enrollments = await Enrollment.find({
      user: { $in: userIds },
      course: courseId,
    }).select("user pricePaid")

    const paidUsers = new Set(
      enrollments
        .filter((e) => e.pricePaid > 0)
        .map((e) => e.user.toString())
    )

    return {
      reviews: reviews.map((review) => {
        const user = review.user as unknown as {
          _id: { toString(): string }
          firstName: string
          lastName: string
          avatarUrl: string
        }

        return {
          id: review._id.toString(),
          userId: user._id.toString(),
          userName: `${user.firstName} ${user.lastName}`,
          userAvatar: user.avatarUrl,
          rating: review.rating,
          title: review.title,
          content: review.content,
          createdAt: review.createdAt.toISOString(),
          isVerifiedPurchase: paidUsers.has(user._id.toString()),
          helpfulCount: review.helpfulCount,
        }
      }),
      total,
    }
  } catch (error) {
    console.error("Get course reviews error:", error)
    return { reviews: [], total: 0 }
  }
}

/**
 * Get rating summary for a course
 */
export async function getCourseRatingSummary(
  courseId: string
): Promise<CourseRatingSummary | null> {
  try {
    await connectDB()

    const course = await Course.findById(courseId).select("rating").lean()

    if (!course) {
      return null
    }

    return {
      average: course.rating?.average || 0,
      count: course.rating?.count || 0,
      distribution: course.rating?.distribution || {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    }
  } catch (error) {
    console.error("Get rating summary error:", error)
    return null
  }
}

/**
 * Check if user has reviewed a course
 */
export async function checkUserReview(
  userId: string,
  courseId: string
): Promise<{ hasReviewed: boolean; reviewId?: string }> {
  try {
    await connectDB()

    const review = await Review.findOne({
      user: userId,
      course: courseId,
    }).select("_id")

    return {
      hasReviewed: review !== null,
      reviewId: review?._id.toString(),
    }
  } catch (error) {
    console.error("Check user review error:", error)
    return { hasReviewed: false }
  }
}

/**
 * Get user's review for a course
 */
export async function getUserReview(
  userId: string,
  courseId: string
): Promise<ReviewItem | null> {
  try {
    await connectDB()

    const review = await Review.findOne({
      user: userId,
      course: courseId,
    })
      .populate("user", "firstName lastName avatarUrl")
      .lean()

    if (!review) {
      return null
    }

    const user = review.user as unknown as {
      _id: { toString(): string }
      firstName: string
      lastName: string
      avatarUrl: string
    }

    return {
      id: review._id.toString(),
      userId: user._id.toString(),
      userName: `${user.firstName} ${user.lastName}`,
      userAvatar: user.avatarUrl,
      rating: review.rating,
      title: review.title,
      content: review.content,
      createdAt: review.createdAt.toISOString(),
      isVerifiedPurchase: true,
      helpfulCount: review.helpfulCount,
    }
  } catch (error) {
    console.error("Get user review error:", error)
    return null
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Recalculate and update course rating aggregate
 */
async function updateCourseRating(courseId: string) {
  const objectId = new mongoose.Types.ObjectId(courseId)
  const stats = await Review.aggregate([
    {
      $match: {
        course: objectId,
        isApproved: true,
        isHidden: false,
      },
    },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
  ])

  // Build distribution
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  let sum = 0

  for (const stat of stats) {
    distribution[stat._id as keyof typeof distribution] = stat.count
    total += stat.count
    sum += stat._id * stat.count
  }

  const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0

  await Course.findByIdAndUpdate(courseId, {
    rating: {
      average,
      count: total,
      distribution,
    },
  })
}
