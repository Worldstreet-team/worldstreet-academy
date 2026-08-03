"use client"

import { useState } from "react"
import Link from "next/link"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  getCourseReviews,
  getCourseRatingSummary,
  markReviewHelpful,
  reportReview,
  type ReviewItem,
} from "@/lib/actions/reviews"
import { cn } from "@/lib/utils"
import { FlagIcon, StarIcon, ThumbsUpIcon } from "lucide-react"

const PAGE_SIZE = 5

type SortOption = "helpful" | "recent"

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "helpful", label: "Most helpful" },
  { value: "recent", label: "Newest" },
]

/** Relative date for review timestamps — reviews can be months old. */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          
          size={size}
          className={star <= Math.round(rating) ? "text-ws-rating" : "text-ws-track"}
          fill="currentColor" />
      ))}
    </div>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
}

function ReviewRow({
  review,
  readOnly,
}: {
  review: ReviewItem
  readOnly: boolean
}) {
  const [markedHelpful, setMarkedHelpful] = useState(false)
  const [reported, setReported] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const helpfulCount = review.helpfulCount + (markedHelpful ? 1 : 0)

  const handleHelpful = async () => {
    if (markedHelpful) return
    setMarkedHelpful(true)
    const result = await markReviewHelpful(review.id)
    if (!result.success) setMarkedHelpful(false)
  }

  const handleReport = async (reason: string) => {
    setReportOpen(false)
    setReported(true)
    const result = await reportReview(review.id, reason)
    if (!result.success) setReported(false)
  }

  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <Avatar size="sm" className="mt-0.5">
          {review.userAvatar && (
            <AvatarImage src={review.userAvatar} alt={review.userName} />
          )}
          <AvatarFallback className="text-[10px]">
            {initials(review.userName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-ws-primary">
              {review.userName}
            </span>
            {review.isVerifiedPurchase && (
              <span className="rounded-full bg-ws-success/15 px-2 py-0.5 text-[10px] font-medium text-ws-success">
                Verified purchase
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Stars rating={review.rating} size={12} />
            <span className="text-xs text-ws-subtle">
              {timeAgo(review.createdAt)}
            </span>
          </div>
          {review.title && (
            <p className="mt-2 text-sm font-medium text-ws-primary">
              {review.title}
            </p>
          )}
          {review.content && (
            <p className="mt-1.5 text-sm leading-relaxed text-ws-muted">
              {review.content}
            </p>
          )}

          {!readOnly && (
            <div className="mt-3 flex items-center gap-4">
              <button
                type="button"
                onClick={handleHelpful}
                disabled={markedHelpful}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs transition-colors",
                  markedHelpful
                    ? "text-ws-gold"
                    : "text-ws-muted hover:text-ws-primary"
                )}
              >
                <ThumbsUpIcon
                  
                  size={13}
                  fill={markedHelpful ? "currentColor" : "none"} />
                Helpful{helpfulCount > 0 && ` · ${helpfulCount}`}
              </button>
              {reported ? (
                <span className="text-xs text-ws-subtle">Reported</span>
              ) : (
                <Popover open={reportOpen} onOpenChange={setReportOpen}>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs text-ws-subtle transition-colors hover:text-ws-danger"
                      />
                    }
                  >
                    <FlagIcon  size={13} />
                    Report
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="w-56 border-ws-hairline bg-ws-surface p-3"
                  >
                    <p className="text-xs font-medium text-ws-primary">
                      Report this review?
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReport("spam")}
                        className="rounded-sm border border-ws-hairline px-2.5 py-1 text-xs text-ws-muted transition-colors hover:bg-ws-raised hover:text-ws-primary"
                      >
                        Spam
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReport("inappropriate")}
                        className="rounded-sm border border-ws-hairline px-2.5 py-1 text-xs text-ws-muted transition-colors hover:bg-ws-raised hover:text-ws-primary"
                      >
                        Inappropriate
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportOpen(false)}
                        className="ml-auto text-xs text-ws-subtle transition-colors hover:text-ws-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Reviews section for course detail pages: rating summary + distribution,
 * sortable paginated review list, and helpful/report actions.
 *
 * `readOnly` (marketing page / guests) hides the helpful/report actions and
 * shows a sign-in hint instead.
 */
export function CourseReviews({
  courseId,
  readOnly = false,
  signInHref,
}: {
  courseId: string
  readOnly?: boolean
  signInHref?: string
}) {
  const [sort, setSort] = useState<SortOption>("helpful")

  const summaryQuery = useQuery({
    queryKey: ["course-rating-summary", courseId],
    queryFn: () => getCourseRatingSummary(courseId),
  })

  const reviewsQuery = useInfiniteQuery({
    queryKey: ["course-reviews", courseId, sort],
    queryFn: ({ pageParam }) =>
      getCourseReviews(courseId, {
        page: pageParam,
        limit: PAGE_SIZE,
        sortBy: sort,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.reviews.length, 0)
      return loaded < lastPage.total ? allPages.length + 1 : undefined
    },
  })

  const summary = summaryQuery.data
  const reviews = reviewsQuery.data?.pages.flatMap((p) => p.reviews) ?? []
  const total = reviewsQuery.data?.pages[0]?.total ?? 0
  const isLoading = summaryQuery.isPending || reviewsQuery.isPending
  const maxBucket = summary
    ? Math.max(1, ...Object.values(summary.distribution))
    : 1

  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">
        Student reviews
      </h2>

      {isLoading ? (
        <div className="rounded-lg border border-ws-hairline bg-ws-surface p-6">
          <div className="h-4 w-40 animate-pulse rounded-sm bg-ws-track" />
          <div className="mt-4 h-3 w-full animate-pulse rounded-sm bg-ws-track" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded-sm bg-ws-track" />
        </div>
      ) : !summary || summary.count === 0 ? (
        <div className="rounded-lg border border-ws-hairline bg-ws-surface px-5 py-6 text-center">
          <p className="text-sm text-ws-muted">
            No reviews yet — be the first after completing a lesson.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-ws-hairline bg-ws-surface p-5 md:p-6">
          {/* Summary: big average + distribution bars */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="shrink-0 sm:pr-6 sm:text-center">
              <p className="font-display text-4xl font-semibold tabular-nums tracking-[-0.02em] text-ws-primary">
                {summary.average.toFixed(1)}
              </p>
              <div className="mt-2 sm:flex sm:justify-center">
                <Stars rating={summary.average} size={16} />
              </div>
              <p className="mt-1.5 text-xs text-ws-muted">
                {summary.count} {summary.count === 1 ? "review" : "reviews"}
              </p>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = summary.distribution[star]
                return (
                  <div key={star} className="flex items-center gap-2.5">
                    <span className="w-3 shrink-0 text-right text-xs tabular-nums text-ws-muted">
                      {star}
                    </span>
                    <StarIcon
                      
                      size={11}
                      className="shrink-0 text-ws-rating"
                      fill="currentColor" />
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ws-track">
                      <div
                        className="h-full rounded-full bg-ws-rating"
                        style={{ width: `${(count / maxBucket) * 100}%` }}
                      />
                    </div>
                    <span className="w-7 shrink-0 text-right text-xs tabular-nums text-ws-subtle">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sort control */}
          {total > 1 && (
            <div className="mt-6 flex items-center gap-1 border-t border-ws-hairline pt-4">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    sort === option.value
                      ? "bg-ws-raised text-ws-primary"
                      : "text-ws-muted hover:text-ws-primary"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {/* Review list */}
          <div
            className={cn(
              "divide-y divide-ws-hairline",
              total > 1 ? "mt-4" : "mt-6 border-t border-ws-hairline pt-5"
            )}
          >
            {reviews.map((review) => (
              <ReviewRow key={review.id} review={review} readOnly={readOnly} />
            ))}
          </div>

          {/* Show more */}
          {reviewsQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => reviewsQuery.fetchNextPage()}
              disabled={reviewsQuery.isFetchingNextPage}
              className="mt-5 w-full rounded-sm border border-ws-hairline py-2 text-xs font-medium text-ws-muted transition-colors hover:bg-ws-raised hover:text-ws-primary disabled:opacity-60"
            >
              {reviewsQuery.isFetchingNextPage
                ? "Loading…"
                : `Show more reviews (${total - reviews.length})`}
            </button>
          )}

          {/* Guest hint (marketing page) */}
          {readOnly && signInHref && (
            <p className="mt-5 border-t border-ws-hairline pt-4 text-xs text-ws-subtle">
              <Link
                href={signInHref}
                className="font-medium text-ws-gold hover:underline"
              >
                Sign in
              </Link>{" "}
              to mark reviews helpful or report them.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
