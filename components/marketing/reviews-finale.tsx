"use client"

import Link from "next/link"
import { StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import type { LandingReview } from "@/lib/actions/reviews"
import { BRAND } from "@/lib/brand"

/**
 * TESTIMONIALS (spec §14). Real reviews only (`fetchLandingReviews` verbatim,
 * clamp-only), as a static card grid: up to six cards, 1 / 2 / 3 columns,
 * narrower when there are fewer. Renders from the FIRST review up — below one
 * review the section vanishes entirely, never an empty shell. No marquee:
 * motion here is a subtle stagger-in and a hover lift of one ladder step.
 */
export function Testimonials({ reviews }: { reviews: LandingReview[] }) {
  if (reviews.length === 0) return null

  const shown = reviews.slice(0, 6)

  return (
    <section className="relative isolate py-20 md:py-28" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <SectionLabel>Testimonials</SectionLabel>
          <SectionTitle id="testimonials-heading" className="mt-4 max-w-2xl">
            Real people.
            <br />
            Real learning experiences.
          </SectionTitle>
        </RevealGroup>

        <div
          className={cn(
            "mt-10 grid grid-cols-1 gap-3 md:mt-12",
            shown.length >= 2 && "sm:grid-cols-2",
            shown.length >= 3 && "lg:grid-cols-3",
            // Fewer reviews: a narrower grid instead of a sparse row.
            shown.length === 1 && "max-w-md",
            shown.length === 2 && "max-w-3xl"
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
 * FINALE (spec §16). The closing band: hairline top border, an always-reachable
 * heading (plain fade-up at viewport amount 0.2, once — it can never
 * dead-end the way the old masked-line reveal did), the two spec paragraphs,
 * and the two CTAs. The glow is absolutely positioned, so it adds zero height —
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
    <section className="relative isolate overflow-hidden border-t border-ws-hairline py-24 text-center md:py-32">
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[20rem] w-[44rem] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{ background: "var(--ws-glow-brand)" }}
      />
      <div className="relative mx-auto max-w-3xl px-6">
        <Reveal
          as="h2"
          amount={0.2}
          className="font-display text-[clamp(2rem,4.6vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ws-primary"
        >
          <span className="block">Your next level starts with</span>
          <span className="block text-ws-gold">what you learn today.</span>
        </Reveal>
        <Reveal
          as="p"
          amount={0.2}
          delay={0.1}
          className="mx-auto mt-7 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]"
        >
          The world is changing. Technology is changing. Business is changing.
          The way people create careers and opportunities is changing. The
          question isn&apos;t whether the world will change. The question is:
          Will you be ready?
        </Reveal>
        <Reveal
          as="p"
          amount={0.2}
          delay={0.14}
          className="mx-auto mt-5 max-w-md font-display text-[16px] font-semibold leading-relaxed tracking-[-0.01em] text-ws-primary md:text-[17px]"
        >
          Choose a skill. Build your knowledge. Develop your capability. Create
          your opportunity.
        </Reveal>
        <Reveal amount={0.2} delay={0.2} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/schools"
            className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-9 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
          >
            Explore programs
          </Link>
          {signedIn ? (
            <Link
              href="/dashboard/courses"
              className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-8 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Enrol now
            </Link>
          ) : (
            <a
              href={registerUrl}
              className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-8 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
            >
              Enrol now
            </a>
          )}
        </Reveal>
        <Reveal
          as="p"
          amount={0.2}
          delay={0.26}
          className="mx-auto mt-10 max-w-xl text-[13px] leading-relaxed text-ws-muted"
        >
          Welcome to {BRAND.name}.{" "}
          <span className="font-semibold text-ws-primary">Learn Skills. Build Value. Create Your Future.</span>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * One review card — everything on it comes from `LandingReview` verbatim
 * (content is clamped, never rewritten). No dates, no invented roles. v2 card:
 * `card` fill, 20px, fill-separated in dark, hairline in light.
 */
function ReviewCard({ review }: { review: LandingReview }) {
  return (
    <figure className="flex h-full flex-col rounded-[20px] border border-ws-hairline bg-ws-surface p-6 transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised dark:border-transparent sm:p-7">
      <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
        {Array.from({ length: review.rating }).map((_, i) => (
          <StarIcon key={i} size={13} fill="currentColor" className="text-ws-rating" />
        ))}
      </div>
      {review.title && (
        <p className="mt-4 font-display text-[16px] font-semibold tracking-[-0.01em] text-ws-primary">{review.title}</p>
      )}
      <blockquote
        className={cn(
          "mb-5 line-clamp-5 text-[15px] leading-[1.65] text-ws-primary/90",
          review.title ? "mt-2" : "mt-4"
        )}
      >
        {review.content}
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 border-t border-ws-hairline pt-4">
        {review.reviewerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.reviewerAvatarUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-ws-hairline"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ws-chip text-[11px] font-semibold text-ws-muted">
            {review.reviewerName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
        )}
        {/* Spec §14: Name · Country · Program — country only when the student set one. */}
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-ws-primary">
            {review.reviewerName}
            {review.country && (
              <span className="font-normal text-ws-muted">{` · ${review.country}`}</span>
            )}
          </span>
          <Link
            href={`/programs/${review.courseSlug}`}
            className="block truncate text-[12.5px] text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
          >
            {review.courseTitle}
          </Link>
        </span>
      </figcaption>
    </figure>
  )
}
