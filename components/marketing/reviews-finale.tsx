"use client"

import Link from "next/link"
import { StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import type { LandingReview } from "@/lib/actions/reviews"

/**
 * §8 — FROM THE FLOOR. Real reviews only (`fetchLandingReviews` verbatim,
 * clamp-only), as a static card grid: up to six cards, 1 / 2 / 3 columns,
 * centered and narrower when there are fewer. Renders from the FIRST review
 * up — below one review the section vanishes entirely, never an empty shell.
 * No marquee: motion here is a subtle stagger-in and a hover border-brighten.
 */
export function Testimonials({ reviews }: { reviews: LandingReview[] }) {
  if (reviews.length === 0) return null

  const shown = reviews.slice(0, 6)

  return (
    <section className="relative isolate py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
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

        <div
          className={cn(
            "mt-12 grid grid-cols-1 gap-5",
            shown.length >= 2 && "sm:grid-cols-2",
            shown.length >= 3 && "lg:grid-cols-3",
            // Fewer reviews: a narrower, centered grid instead of a sparse row.
            shown.length === 1 && "mx-auto max-w-md",
            shown.length === 2 && "mx-auto max-w-3xl"
          )}
        >
          {shown.map((review, i) => (
            <Reveal key={review.id} delay={(i % 3) * 0.07} y={20} duration={0.6}>
              <ReviewCard review={review} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * §10 — FINALE. A compact CTA band: hairline top border, an always-reachable
 * heading (plain fade-up at viewport amount 0.2, once — it can never
 * dead-end the way the old masked-line reveal did), one supporting line, and
 * the two CTAs. The glow is absolutely positioned, so it adds zero height —
 * no minimum-height caverns.
 */
export function FinaleCta({
  signedIn,
  registerUrl,
}: {
  signedIn: boolean
  registerUrl: string
}) {
  return (
    <section className="relative isolate overflow-hidden border-t border-ws-hairline py-20 text-center md:py-24">
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[20rem] w-[44rem] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{ background: "var(--ws-glow-brand)" }}
      />
      <div className="relative mx-auto max-w-3xl px-6">
        <Reveal as="h2" amount={0.2} className="font-display text-[clamp(2.5rem,5.5vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ws-primary">
          <span className="block">Ready when</span>
          <span className="block text-ws-gold">the market is.</span>
        </Reveal>
        <Reveal as="p" amount={0.2} delay={0.1} className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ws-muted">
          Courses run beginner to advanced — start where you are.
        </Reveal>
        <Reveal amount={0.2} delay={0.18} className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
        </Reveal>
      </div>
    </section>
  )
}

/**
 * One review card — everything on it comes from `LandingReview` verbatim
 * (content is clamped, never rewritten). No dates, no invented roles.
 */
function ReviewCard({ review }: { review: LandingReview }) {
  return (
    <figure className="flex h-full flex-col rounded-xl border border-ws-hairline bg-ws-surface p-6 transition-colors duration-[var(--ws-motion-base)] hover:border-ws-brand/30">
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
          "mb-4 line-clamp-5 text-[15px] leading-relaxed text-ws-primary/90",
          review.title ? "mt-1.5" : "mt-3"
        )}
      >
        {review.content}
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-2.5 border-t border-ws-hairline pt-4">
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
