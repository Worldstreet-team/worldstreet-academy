"use server"

import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Course, Lesson, Review, type LessonType, type PackageKey } from "@/lib/db/models"
import { PACKAGE_RANK, effectiveLessonTier } from "@/lib/entitlements"
import { countryName } from "@/lib/countries"
import { maskedName } from "@/lib/masked-name"
import { getCourseRatingSummary, type CourseRatingSummary } from "@/lib/actions/reviews"

/**
 * Public reads behind the program page (`/programs/[slug]`): the curriculum
 * and the reviews. Both are anonymous server actions — callable by anyone,
 * with any arguments — so each validates its input, reads only published
 * courses, and returns only what the page prints. Errors resolve to empty
 * results; nothing throws across the boundary.
 */

// ============================================================================
// CURRICULUM
// ============================================================================

export type ProgramCurriculumLesson = {
  id: string
  title: string
  type: LessonType
  /** Video length in seconds; null for text and live lessons, or a video without a length. */
  durationSec: number | null
  isFree: boolean
  /**
   * The tier this lesson needs when that is ABOVE the program's cheapest
   * enabled tier (`effectiveLessonTier`), else null. Free previews are open
   * to everyone, so they never carry one.
   */
  tier: PackageKey | null
  sectionTitle: string | null
  /** Only on free video lessons — the same exposure rule as `fetchPublicCourse`. */
  videoUrl: string | null
  /** The lesson's own poster; null falls back to the program art at render. */
  posterUrl: string | null
}

/**
 * The published lessons of a published program, in course order, with the
 * fields a curriculum row needs. The page derives its lesson count and total
 * length from this list, not from the stored `totalLessons`/`totalDuration`
 * counters, which drift.
 */
export async function fetchProgramCurriculum(courseId: string): Promise<ProgramCurriculumLesson[]> {
  try {
    if (typeof courseId !== "string" || !mongoose.isValidObjectId(courseId)) return []
    await connectDB()

    const course = await Course.findOne({ _id: courseId, status: "published" }).select("packages").lean()
    if (!course) return []

    const enabled = (course.packages ?? []).filter((p) => p.enabled)
    const cheapestRank = enabled.length > 0 ? Math.min(...enabled.map((p) => PACKAGE_RANK[p.key])) : null

    const lessons = await Lesson.find({ course: courseId, isPublished: true })
      .sort({ order: 1 })
      .select("title type videoDuration isFree minPackageKey sectionTitle videoUrl videoThumbnailUrl")
      .lean()

    return lessons.map((lesson) => {
      const tier = lesson.isFree ? null : effectiveLessonTier(course, lesson)
      const video = lesson.type === "video"
      return {
        id: lesson._id.toString(),
        title: lesson.title,
        type: lesson.type,
        durationSec: video && lesson.videoDuration && lesson.videoDuration > 0 ? Math.round(lesson.videoDuration) : null,
        isFree: Boolean(lesson.isFree),
        tier: tier && cheapestRank !== null && PACKAGE_RANK[tier] > cheapestRank ? tier : null,
        sectionTitle: lesson.sectionTitle?.trim() || null,
        videoUrl: lesson.isFree && video ? lesson.videoUrl || null : null,
        posterUrl: lesson.isFree && video ? lesson.videoThumbnailUrl || null : null,
      }
    })
  } catch (error) {
    console.error("Fetch program curriculum error:", error)
    return []
  }
}

// ============================================================================
// REVIEWS
// ============================================================================

/** One written review as the public page prints it: no user id, no email, no last name. */
export type PublicReview = {
  id: string
  rating: number
  title: string | null
  content: string | null
  /** "Ada A." — first name and last initial (the same masking as /verify). */
  reviewerName: string
  reviewerAvatarUrl: string | null
  /** English country name; null when the reviewer hasn't set one. */
  country: string | null
  createdAt: string
}

export type ProgramReviewsPage = {
  /** `Course.rating` — present on page 1 only; later pages only append reviews. */
  summary: CourseRatingSummary | null
  reviews: PublicReview[]
  /** Written reviews in total (approved, visible, with a title or text). */
  total: number
  page: number
  hasMore: boolean
}

/** Server-side cap: a caller can ask for less, never more. */
const MAX_PAGE_SIZE = 12

const EMPTY_PAGE: ProgramReviewsPage = { summary: null, reviews: [], total: 0, page: 1, hasMore: false }

/**
 * Written reviews of a published program, featured first, then the most
 * helpful, then the newest. A review with neither a title nor text is a
 * rating, not a review — it counts in the summary and is not listed.
 */
export async function fetchProgramReviews(
  courseId: string,
  page = 1,
  pageSize = 6
): Promise<ProgramReviewsPage> {
  try {
    if (typeof courseId !== "string" || !mongoose.isValidObjectId(courseId)) return EMPTY_PAGE
    const safePage = Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1
    const limit = Number.isInteger(pageSize) ? Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE) : 6

    await connectDB()
    const published = await Course.exists({ _id: courseId, status: "published" })
    if (!published) return EMPTY_PAGE

    const match = {
      course: new mongoose.Types.ObjectId(courseId),
      isApproved: true,
      isHidden: false,
      $or: [{ content: { $nin: [null, ""] } }, { title: { $nin: [null, ""] } }],
    }

    // Featured ranks as `featured === true ? 1 : 0` — the landing's rule: a
    // review older than the field has no value, and a raw sort would put an
    // explicit false above it.
    const [ranked, total, summary] = await Promise.all([
      Review.aggregate<{
        _id: mongoose.Types.ObjectId
        user: mongoose.Types.ObjectId
        rating: number
        title?: string | null
        content?: string | null
        createdAt: Date
      }>([
        { $match: match },
        { $addFields: { featuredRank: { $cond: [{ $eq: ["$featured", true] }, 1, 0] } } },
        { $sort: { featuredRank: -1, helpfulCount: -1, createdAt: -1, _id: -1 } },
        { $skip: (safePage - 1) * limit },
        { $limit: limit },
        { $project: { user: 1, rating: 1, title: 1, content: 1, createdAt: 1 } },
      ]),
      Review.countDocuments(match),
      safePage === 1 ? getCourseRatingSummary(courseId) : Promise.resolve(null),
    ])

    const withUsers = await Review.populate(ranked, {
      path: "user",
      select: "firstName lastName avatarUrl country",
    })

    const reviews: PublicReview[] = withUsers.map((r) => {
      const user = r.user as unknown as {
        firstName?: string | null
        lastName?: string | null
        avatarUrl?: string | null
        country?: string | null
      } | null
      return {
        id: r._id.toString(),
        rating: r.rating,
        title: r.title?.trim() || null,
        content: r.content?.trim() || null,
        reviewerName: maskedName(user?.firstName, user?.lastName),
        reviewerAvatarUrl: user?.avatarUrl || null,
        country: countryName(user?.country),
        createdAt: new Date(r.createdAt).toISOString(),
      }
    })

    return {
      summary,
      reviews,
      total,
      page: safePage,
      hasMore: (safePage - 1) * limit + reviews.length < total,
    }
  } catch (error) {
    console.error("Fetch program reviews error:", error)
    return EMPTY_PAGE
  }
}
