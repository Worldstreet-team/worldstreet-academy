"use client"

import * as React from "react"
import Link from "next/link"
import { StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { LineMask } from "@/components/marketing/motion/line-mask"
import { Marquee } from "@/components/marketing/motion/marquee"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import { motion } from "motion/react"
import type { LandingReview } from "@/lib/actions/reviews"

/**
 * §7 — FROM THE FLOOR + FINALE. Real reviews only (`fetchLandingReviews`
 * verbatim, clamp-only) in two opposing marquee rows; below the 3-review
 * floor the section is just the finale. Fallbacks: reduced motion, or coarse
 * pointer with <7 reviews → static columns grid; coarse with ≥7 → one row.
 */
export function ReviewsFinale({
  reviews,
  signedIn,
  registerUrl,
}: {
  reviews: LandingReview[]
  signedIn: boolean
  registerUrl: string
}) {
  const ok = useMotionOK()
  const coarse = useMediaQuery("(pointer: coarse)")

  const showReviews = reviews.length >= 3
  // Below 7 reviews a marquee row is sparser than the viewport on ANY
  // pointer — a lone card drifting across a blank band. Grid until dense.
  const useStaticGrid = !ok || reviews.length < 7
  const singleRow = coarse && reviews.length >= 7

  const topRow = reviews.filter((_, i) => i % 2 === 0)
  const bottomRow = reviews.filter((_, i) => i % 2 === 1)

  return (
    <>
      {showReviews && (
        <section className="relative isolate overflow-hidden py-28">
          <div className="mx-auto max-w-6xl px-6 pb-12">
            <RevealGroup>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
                From the floor
              </p>
              <h2
                className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
                style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
              >
                Rated by the people who did the work.
              </h2>
            </RevealGroup>
          </div>

          {useStaticGrid ? (
            <div className="mx-auto max-w-6xl gap-5 px-6 columns-1 md:columns-2 lg:columns-3">
              {reviews.slice(0, 6).map((review, i) => (
                <Reveal key={review.id} delay={i * 0.07} className="mb-5 break-inside-avoid">
                  <ReviewCard review={review} />
                </Reveal>
              ))}
            </div>
          ) : singleRow ? (
            <Marquee speed={22} direction="left">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} className="w-[19rem]" />
              ))}
            </Marquee>
          ) : (
            <div className="space-y-5">
              <Marquee speed={28} direction="left">
                {topRow.map((review) => (
                  <ReviewCard key={review.id} review={review} className="w-[22rem]" />
                ))}
              </Marquee>
              <Marquee speed={22} direction="right">
                {bottomRow.map((review) => (
                  <ReviewCard key={review.id} review={review} className="w-[22rem]" />
                ))}
              </Marquee>
            </div>
          )}
        </section>
      )}

      {/* ── Finale ── */}
      <section className="relative isolate overflow-hidden py-32 text-center md:py-44">
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[36rem] w-[56rem] max-w-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
          style={{ background: "var(--ws-glow-brand)" }}
        />
        <div className="relative mx-auto max-w-4xl px-6">
          <LineMask
            as="h2"
            mode="inview"
            className="font-display text-[clamp(2.75rem,7vw,6.5rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-ws-primary"
            lines={[
              { text: "Ready when" },
              { text: "the market is.", className: "text-ws-gold" },
            ]}
          />
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
            initial={{ opacity: 0, y: ok ? 20 : 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7, ease: EASE_INERTIA, delay: 0.25 }}
          >
            {signedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-9 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
              >
                Get started
              </Link>
            ) : (
              <a
                href={registerUrl}
                className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-9 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
              >
                Get started
              </a>
            )}
            <Link
              href="/courses"
              className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-8 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Browse courses
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  )
}

/**
 * One review card — everything on it comes from `LandingReview` verbatim
 * (content is clamped, never rewritten). No dates, no invented roles.
 */
function ReviewCard({
  review,
  className,
}: {
  review: LandingReview
  className?: string
}) {
  return (
    <figure
      className={cn(
        "flex shrink-0 flex-col rounded-lg border border-ws-hairline bg-ws-surface p-5",
        className
      )}
    >
      <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
        {Array.from({ length: review.rating }).map((_, i) => (
          <StarIcon key={i} size={12} fill="currentColor" className="text-ws-rating" />
        ))}
      </div>
      {review.title && (
        <p className="mt-3 text-[14px] font-semibold text-ws-primary">{review.title}</p>
      )}
      <blockquote
        className={cn(
          "line-clamp-4 text-[15px] leading-relaxed text-ws-primary/90",
          review.title ? "mt-1.5" : "mt-3"
        )}
      >
        {review.content}
      </blockquote>
      <figcaption className="mt-4 flex items-center gap-2.5 border-t border-ws-hairline pt-4">
        {review.reviewerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.reviewerAvatarUrl}
            alt=""
            className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-ws-hairline"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ws-chip text-[10px] font-semibold text-ws-muted">
            {review.reviewerName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ws-primary">
            {review.reviewerName}
          </span>
          <Link
            href={`/courses/${review.courseId}`}
            className="block truncate text-[12px] text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-gold"
          >
            on {review.courseTitle}
          </Link>
        </span>
      </figcaption>
    </figure>
  )
}
