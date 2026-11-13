"use server"

import { revalidatePath } from "next/cache"
import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Review, Course, Enrollment } from "@/lib/db/models"
import { z } from "zod/v4"
import { countryName } from "@/lib/countries"
import { schoolSlugOf } from "@/lib/schools"
import { getCurrentUser } from "@/lib/auth"

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Title and text are optional: a review without either is a rating. On an
// update, null clears them.
const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(100).nullable().optional(),
  content: z.string().trim().min(10).max(2000).nullable().optional(),
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

// 2026-11-12: ids arrive from the browser untyped; only id strings reach a query.
const OBJECT_ID = /^[a-f0-9]{24}$/
function isId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID.test(value)
}

/** "Ada" when there is no last name — never "Ada undefined". */
function fullName(user: { firstName?: string | null; lastName?: string | null }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
}

/** Server actions are callable with any arguments: a userId from the browser must be the signed-in user. */
async function isSignedInAs(userId: string): Promise<boolean> {
  const user = await getCurrentUser()
  return !!user && user.id === userId
}

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
    if (!(await isSignedInAs(userId))) return { success: false, error: "Unauthorized" }
    if (!isId(courseId)) return { success: false, error: "Course not found" }

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

    await revalidateReviewPages(courseId)

    return {
      success: true,
      data: { reviewId: review._id.toString() },
    }
  } catch (error) {
    // 2026-11-12: two tabs posting at once — the unique { user, course } index kept one.
    if ((error as { code?: number } | null)?.code === 11000) {
      return { success: false, error: "Already reviewed this course" }
    }
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
    if (!(await isSignedInAs(userId))) return { success: false, error: "Unauthorized" }
    if (!isId(reviewId)) return { success: false, error: "Review not found" }

    const validated = UpdateReviewSchema.parse(data)

    const review = await Review.findOne({
      _id: reviewId,
      user: userId,
    })

    if (!review) {
      return { success: false, error: "Review not found" }
    }

    Object.assign(review, validated)
    // An edit un-features: a curated homepage slot must never show words no
    // admin read. (Mongoose marks a path modified only when its value changes.)
    if (review.isModified("content") || review.isModified("title") || review.isModified("rating")) {
      review.featured = false
    }
    review.updatedAt = new Date()
    await review.save()

    // Update course rating if rating changed
    if (validated.rating) {
      await updateCourseRating(review.course.toString())
    }

    await revalidateReviewPages(review.course.toString())

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
    if (!(await isSignedInAs(userId))) return { success: false, error: "Unauthorized" }
    if (!isId(reviewId)) return { success: false, error: "Review not found" }

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

    await revalidateReviewPages(courseId)

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
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Sign in to mark a review helpful" }
    if (!mongoose.isValidObjectId(reviewId)) return { success: false, error: "Review not found" }

    // Once per user: the filter only matches while this user isn't counted yet.
    // 2026-11-12: and never on your own review.
    // { _id: reviewId, helpfulBy: { $ne: user.id } },
    await Review.updateOne(
      { _id: reviewId, user: { $ne: user.id }, helpfulBy: { $ne: user.id } },
      { $inc: { helpfulCount: 1 }, $addToSet: { helpfulBy: user.id } }
    )

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
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "Sign in to report a review" }
    if (!mongoose.isValidObjectId(reviewId)) return { success: false, error: "Review not found" }
    const parsed = z.string().trim().min(1).max(200).safeParse(reason)
    if (!parsed.success) return { success: false, error: "Choose a reason" }

    // One report per user, so the admin queue's count means distinct people.
    await Review.updateOne(
      { _id: reviewId, "reports.user": { $ne: user.id } },
      { $inc: { reportCount: 1 }, $push: { reports: { user: user.id, reason: parsed.data, reportedAt: new Date() } } }
    )

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
    if (!isId(courseId)) return { reviews: [], total: 0 }
    await connectDB()

    // 2026-11-12: page and limit arrive from the browser — a negative page threw
    // (empty list) and a huge limit read every review at once.
    // const { page = 1, limit = 10, sortBy = "recent" } = options
    const { sortBy = "recent" } = options ?? {}
    const page = Math.max(1, Math.trunc(Number(options?.page)) || 1)
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(options?.limit)) || 10))

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
    // 2026-11-12: a reviewer whose account no longer exists threw here and
    // emptied the program's reviews; their review is skipped.
    // const userIds = reviews.map((r) => r.user._id)
    const shown = reviews.filter((r) => r.user)
    const userIds = shown.map((r) => r.user._id)
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
      // reviews: reviews.map((review) => {
      reviews: shown.map((review) => {
        const user = review.user as unknown as {
          _id: { toString(): string }
          firstName: string
          lastName: string
          avatarUrl: string
        }

        return {
          id: review._id.toString(),
          userId: user._id.toString(),
          // userName: `${user.firstName} ${user.lastName}`,
          userName: fullName(user),
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
    if (!isId(courseId)) return null
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
    if (!(await isSignedInAs(userId))) return { hasReviewed: false }
    if (!isId(courseId)) return { hasReviewed: false }

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
    if (!(await isSignedInAs(userId))) return null
    if (!isId(courseId)) return null

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
      // userName: `${user.firstName} ${user.lastName}`,
      userName: fullName(user),
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
 * The public pages that print a program's reviews or rating: its program
 * page, its school's page, and the landing's testimonials. (`/courses/<id>`
 * only redirects, so revalidating it refreshed nothing.)
 */
async function revalidateReviewPages(courseId: string) {
  const course = await Course.findById(courseId).select("slug school").lean()
  if (course?.slug) revalidatePath(`/programs/${course.slug}`)
  const school = schoolSlugOf(course?.school)
  if (school) revalidatePath(`/schools/${school}`)
  revalidatePath("/")
}

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

// ============================================================================
// LANDING TESTIMONIALS
// ============================================================================

export type LandingReview = {
  id: string
  rating: number
  title: string | null
  content: string
  reviewerName: string
  reviewerAvatarUrl: string | null
  /** Reviewer's country as an English display name ("Nigeria"); null when they haven't set one (spec §14). */
  country: string | null
  courseTitle: string
  courseId: string
  courseSlug: string
}

/**
 * Real testimonials for the landing page (spec §14): approved, visible 4–5★
 * reviews that actually say something. Admin-featured reviews come first (so
 * the homepage six are curated), then the best-rated. Featuring never bypasses
 * this floor, and nothing here is ever typed in by hand.
 */
export async function fetchLandingReviews(limit = 6): Promise<LandingReview[]> {
  try {
    // 2026-11-12: from the browser it can be anything; a sane page only.
    limit = Math.min(24, Math.max(1, Math.trunc(Number(limit)) || 6))
    await connectDB()

    // Featured ranks as `featured === true ? 1 : 0`. Reviews older than the field
    // have no value at all, and a raw `featured: -1` sort puts an explicit false
    // (any review an admin ever un-featured) above them, whatever the rating.
    const ranked = await Review.aggregate<{
      _id: mongoose.Types.ObjectId
      user: mongoose.Types.ObjectId
      course: mongoose.Types.ObjectId
      rating: number
      title?: string | null
      content?: string | null
    }>([
      {
        $match: {
          isApproved: true,
          isHidden: false,
          rating: { $gte: 4 },
          content: { $nin: [null, ""] },
        },
      },
      { $addFields: { featuredRank: { $cond: [{ $eq: ["$featured", true] }, 1, 0] } } },
      { $sort: { featuredRank: -1, rating: -1, helpfulCount: -1, createdAt: -1 } },
      { $limit: limit * 2 }, // room to drop reviews of unpublished courses below
    ])
    const reviews = await Review.populate(ranked, [
      { path: "user", select: "firstName lastName avatarUrl country" },
      { path: "course", select: "title status slug" },
    ])

    return reviews
      .map((r) => {
        const user = r.user as unknown as {
          firstName?: string
          lastName?: string
          avatarUrl?: string | null
          country?: string | null
        } | null
        const course = r.course as unknown as {
          _id: { toString(): string }
          title?: string
          status?: string
          slug?: string
        } | null
        if (!course || course.status !== "published") return null
        const name = user
          ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
          : ""
        return {
          id: r._id.toString(),
          rating: r.rating,
          title: r.title ?? null,
          content: r.content ?? "",
          reviewerName: name || "WorldStreet learner",
          reviewerAvatarUrl: user?.avatarUrl ?? null,
          country: countryName(user?.country),
          courseTitle: course.title ?? "",
          courseId: course._id.toString(),
          courseSlug: course.slug ?? "",
        }
      })
      .filter((r): r is LandingReview => r !== null && r.content.length > 0)
      .slice(0, limit)
  } catch (error) {
    console.error("Fetch landing reviews error:", error)
    return []
  }
}
