"use client"

import * as React from "react"
import Link from "next/link"
import { fetchProgramReviews, type ProgramReviewsPage, type PublicReview } from "@/lib/actions/program-page"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ClampedText } from "@/components/programs/clamped-text"
import { Stars } from "@/components/programs/stars"
import { initialsOf, plural } from "@/components/programs/format"
import { PROGRAM_H2, SECTION_SCROLL_MT } from "@/components/programs/section-title"

const PAGE_SIZE = 6

/** "Sep 2026" — pinned to UTC so the server render and the browser agree. */
function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

/**
 * The program's reviews: the rating summary (`Course.rating` — average,
 * count, the 5→1 distribution) beside the written reviews, featured and most
 * helpful first. The page renders page 1 on the server; "Show more reviews"
 * appends the next page through the public `fetchProgramReviews` action.
 *
 * Nothing is fabricated: the page leaves this section out when there are no
 * ratings and no written reviews; ratings without words show the summary and
 * say there are no written reviews yet; words without a stored rating show
 * the words alone. No helpful/report buttons here — those need a signed-in
 * visitor and live on the signed-in course page.
 */
export function ProgramReviews({
  courseId,
  sectionId,
  initial,
}: {
  courseId: string
  sectionId: string
  initial: ProgramReviewsPage
}) {
  const [reviews, setReviews] = React.useState<PublicReview[]>(initial.reviews)
  const [page, setPage] = React.useState(initial.page)
  const [hasMore, setHasMore] = React.useState(initial.hasMore)
  const [loading, setLoading] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  const summary = initial.summary && initial.summary.count > 0 ? initial.summary : null

  async function loadMore() {
    setLoading(true)
    setFailed(false)
    const next = await fetchProgramReviews(courseId, page + 1, PAGE_SIZE)
    setLoading(false)
    if (next.reviews.length === 0) {
      // The action answers any error with an empty page (total 0): say so and
      // keep the button for a retry. A real empty page just ends the list.
      if (next.total === 0) setFailed(true)
      else setHasMore(false)
      return
    }
    setReviews((prev) => {
      const seen = new Set(prev.map((r) => r.id))
      return [...prev, ...next.reviews.filter((r) => !seen.has(r.id))]
    })
    setPage(next.page)
    setHasMore(next.hasMore)
  }

  const remaining = Math.max(0, initial.total - reviews.length)

  return (
    <section id={sectionId} aria-labelledby="reviews-heading" className={SECTION_SCROLL_MT}>
      <h2 id="reviews-heading" className={PROGRAM_H2}>
        Learner reviews
      </h2>

      <div className={cn("mt-8 grid gap-10", summary && "lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14")}>
        {summary && <RatingSummary summary={summary} />}

        <div className="min-w-0">
          {reviews.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-ws-hairline px-6 py-8 text-[15px] text-ws-muted">
              No written reviews yet.
            </p>
          ) : (
            <>
              <ul className={cn("grid gap-4", reviews.length > 1 && "md:grid-cols-2")}>
                {reviews.map((review) => (
                  <li key={review.id} className="flex">
                    <ReviewCard review={review} wide={reviews.length === 1} />
                  </li>
                ))}
              </ul>
              {hasMore && (
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loading}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-ws-hairline px-6 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 disabled:opacity-60"
                  >
                    {loading ? "Loading reviews…" : "Show more reviews"}
                  </button>
                  {remaining > 0 && !failed && (
                    <span className="text-[13px] tabular-nums text-ws-muted">{remaining.toLocaleString("en-US")} more</span>
                  )}
                  {failed && (
                    <span role="status" className="text-[13px] text-ws-muted">
                      Couldn&apos;t load more reviews. Try again.
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/** Average, stars, count and the 5→1 distribution. Also the school page's aggregate. */
export function RatingSummary({ summary }: { summary: NonNullable<ProgramReviewsPage["summary"]> }) {
  const buckets = ([5, 4, 3, 2, 1] as const).map((star) => ({ star, count: summary.distribution?.[star] ?? 0 }))
  const counted = buckets.reduce((sum, b) => sum + b.count, 0)

  return (
    <div>
      <p className="flex items-end gap-3">
        <span className="font-display text-[4.5rem] font-light leading-[0.85] tabular-nums tracking-[-0.04em] text-ws-primary">
          {summary.average.toFixed(1)}
        </span>
        <span className="pb-1 text-[14px] text-ws-muted">out of 5</span>
      </p>
      <Stars rating={summary.average} size={20} label={`Rated ${summary.average.toFixed(1)} out of 5`} className="mt-4" />
      <p className="mt-2 text-[14px] tabular-nums text-ws-muted">{plural(summary.count, "rating")}</p>

      {counted > 0 && (
        <ul className="mt-7 space-y-2.5" aria-label="Rating distribution">
          {buckets.map(({ star, count }) => {
            const pct = Math.round((count / counted) * 100)
            return (
              <li key={star} className="flex items-center gap-3 text-[13px]">
                <span className="w-12 shrink-0 tabular-nums text-ws-muted">{plural(star, "star")}</span>
                <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ws-track" aria-hidden>
                  <span className="absolute inset-y-0 left-0 rounded-full bg-ws-muted" style={{ width: `${(count / counted) * 100}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums text-ws-primary">{pct}%</span>
                <span className="sr-only">
                  {plural(count, "rating")} of {plural(star, "star")}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * One written review. `program` tags it with the program it reviews — the
 * school page lists several programs' reviews together; the program page
 * leaves it out.
 */
export function ReviewCard({
  review,
  wide,
  program,
}: {
  review: PublicReview
  wide: boolean
  program?: { title: string; slug: string }
}) {
  return (
    <article className="flex w-full flex-col rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent">
      <header className="flex items-center gap-3">
        <Avatar className="size-10 shrink-0">
          {review.reviewerAvatarUrl && <AvatarImage src={review.reviewerAvatarUrl} alt="" />}
          <AvatarFallback className="bg-ws-raised text-[13px] font-semibold text-ws-primary">
            {initialsOf(review.reviewerName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ws-primary">{review.reviewerName}</p>
          {review.country && <p className="truncate text-[13px] text-ws-muted">{review.country}</p>}
        </div>
      </header>
      <div className="mt-4 flex items-center gap-3">
        <Stars rating={review.rating} size={15} label={`${review.rating} out of 5 stars`} />
        <time dateTime={review.createdAt} className="text-[13px] tabular-nums text-ws-muted">
          {monthYear(review.createdAt)}
        </time>
      </div>
      {review.title && (
        <h3 className="mt-3 font-display text-[16px] font-semibold leading-snug text-ws-primary">{review.title}</h3>
      )}
      {review.content && (
        <div className={review.title ? "mt-1.5" : "mt-3"}>
          <ClampedText
            text={review.content}
            lines={wide ? 5 : 6}
            className={cn("leading-relaxed text-ws-primary/85", wide ? "max-w-3xl text-[17px]" : "text-[15px]")}
          />
        </div>
      )}
      {program && (
        <div className="mt-auto pt-5">
          <p className="border-t border-ws-hairline pt-4 text-[13px] text-ws-muted">
            On{" "}
            <Link
              href={`/programs/${program.slug}`}
              className="rounded-sm font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
            >
              {program.title}
            </Link>
          </p>
        </div>
      )}
    </article>
  )
}
