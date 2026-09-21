"use server"

import mongoose from "mongoose"
import connectDB from "@/lib/db"
import { Course, Review } from "@/lib/db/models"
import { isSchoolSlug } from "@/lib/schools"
import { countryName } from "@/lib/countries"
import { maskedName } from "@/lib/masked-name"
import type { CourseRatingSummary } from "@/lib/actions/reviews"
import type { PublicReview } from "@/lib/actions/program-page"

/**
 * Public read behind the school page (`/schools/[slug]`): what learners made
 * of the school's programs, taken together. An anonymous server action —
 * callable by anyone, with any arguments — so it validates the slug, reads
 * only published programs, and returns only what the page prints: masked
 * reviewer names, no user ids. Errors resolve to an empty result.
 */

/** A written review as the school page prints it: the program's public review, tagged with the program. */
export type SchoolReview = PublicReview & { program: { title: string; slug: string } }

export type SchoolReviews = {
  /**
   * Every published program's stored rating (`Course.rating`) combined: the
   * counts summed, the average weighted by each program's count, the 5→1
   * distribution summed. Null when no program has a rating yet.
   */
  summary: CourseRatingSummary | null
  /** Programs with at least one rating — the "across N programs" the summary speaks for. */
  ratedPrograms: number
  /** The best written reviews, a fair share per program (see below). */
  reviews: SchoolReview[]
  /** Written reviews in total (approved, visible, with a title or text) across the school. */
  total: number
}

const EMPTY: SchoolReviews = { summary: null, ratedPrograms: 0, reviews: [], total: 0 }

/** Server-side cap: a caller can ask for less, never more. */
const MAX_REVIEWS = 12

const STARS = [1, 2, 3, 4, 5] as const

export async function fetchSchoolReviews(slug: string, limit = 6): Promise<SchoolReviews> {
  try {
    if (!isSchoolSlug(slug)) return EMPTY
    const size = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), MAX_REVIEWS) : 6

    await connectDB()
    const courses = await Course.find({ school: slug, status: "published" }).select("title slug rating").lean()
    if (courses.length === 0) return EMPTY

    let count = 0
    let weighted = 0
    let ratedPrograms = 0
    const distribution: CourseRatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const course of courses) {
      const n = course.rating?.count ?? 0
      if (n <= 0) continue
      ratedPrograms += 1
      count += n
      weighted += (course.rating?.average ?? 0) * n
      for (const star of STARS) distribution[star] += course.rating?.distribution?.[star] ?? 0
    }
    const summary = count > 0 ? { average: weighted / count, count, distribution } : null

    const programs = new Map(courses.map((c) => [c._id.toString(), { title: c.title, slug: c.slug }]))
    const match = {
      course: { $in: courses.map((c) => c._id) },
      isApproved: true,
      isHidden: false,
      $or: [{ content: { $nin: [null, ""] } }, { title: { $nin: [null, ""] } }],
    }

    // The program page's order (featured, then most helpful, then newest),
    // with the higher rating breaking a helpfulness tie. A deeper pool than
    // the page shows, so the pick below can spread it across programs.
    const [ranked, total] = await Promise.all([
      Review.aggregate<{
        _id: mongoose.Types.ObjectId
        user: mongoose.Types.ObjectId
        course: mongoose.Types.ObjectId
        rating: number
        title?: string | null
        content?: string | null
        createdAt: Date
      }>([
        { $match: match },
        { $addFields: { featuredRank: { $cond: [{ $eq: ["$featured", true] }, 1, 0] } } },
        { $sort: { featuredRank: -1, helpfulCount: -1, rating: -1, createdAt: -1, _id: -1 } },
        { $limit: size * 3 },
        { $project: { user: 1, course: 1, rating: 1, title: 1, content: 1, createdAt: 1 } },
      ]),
      Review.countDocuments(match),
    ])

    // A fair share: take each program's best in turn (round-robin, in rank
    // order), so one much-reviewed program can't fill the section alone.
    const queues = new Map<string, typeof ranked>()
    for (const review of ranked) {
      const key = review.course.toString()
      queues.set(key, [...(queues.get(key) ?? []), review])
    }
    const picked: typeof ranked = []
    while (picked.length < size && [...queues.values()].some((q) => q.length > 0)) {
      for (const queue of queues.values()) {
        const next = queue.shift()
        if (next && picked.length < size) picked.push(next)
      }
    }

    const withUsers = await Review.populate(picked, { path: "user", select: "firstName lastName avatarUrl country" })

    const reviews: SchoolReview[] = withUsers.flatMap((r) => {
      const program = programs.get(r.course.toString())
      if (!program) return []
      const user = r.user as unknown as {
        firstName?: string | null
        lastName?: string | null
        avatarUrl?: string | null
        country?: string | null
      } | null
      return [
        {
          id: r._id.toString(),
          rating: r.rating,
          title: r.title?.trim() || null,
          content: r.content?.trim() || null,
          reviewerName: maskedName(user?.firstName, user?.lastName),
          reviewerAvatarUrl: user?.avatarUrl || null,
          country: countryName(user?.country),
          createdAt: new Date(r.createdAt).toISOString(),
          program,
        },
      ]
    })

    return { summary, ratedPrograms, reviews, total }
  } catch (error) {
    console.error("Fetch school reviews error:", error)
    return EMPTY
  }
}
