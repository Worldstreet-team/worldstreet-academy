"use client"

import * as React from "react"
import Link from "next/link"
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"
import { StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import type { LandingReview } from "@/lib/actions/reviews"
import { BRAND } from "@/lib/brand"

/** From this many reviews up, two rows slide past each other. */
const ROWS_FROM = 6
/** At most this many reviews on the page (four per row). */
const MAX_REVIEWS = 8

/**
 * TESTIMONIALS (spec §14). Real reviews only (`fetchLandingReviews` verbatim,
 * clamp-only) — never duplicated to fill space, and below one review the
 * section vanishes entirely, never an empty shell.
 *
 * Moved by scroll, never by a clock:
 * - six or more: two full-bleed rows that travel in opposite directions as
 *   the section passes, far enough that every card crosses the stage;
 * - fewer: the familiar 1 / 2 / 3-column grid, whose cards are dealt in from
 *   alternating sides as each reaches the viewport and settle at rest well
 *   before the middle of the screen.
 * Reduced motion: the grid (or the rows as a still, wrapped grid), standing.
 *
 * `overflow-x-clip` (not hidden) keeps the travel off the page's width
 * without making the section a scroll container, so focusing a card's link
 * can never scroll the rows sideways behind the motion's back.
 */
export function Testimonials({ reviews }: { reviews: LandingReview[] }) {
  if (reviews.length === 0) return null

  const shown = reviews.slice(0, MAX_REVIEWS)

  return (
    <section
      className="relative isolate overflow-x-clip py-14 sm:py-20 md:py-28"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <SectionLabel>Testimonials</SectionLabel>
          <SectionTitle id="testimonials-heading" className="mt-4 max-w-2xl">
            Real people.
            <br />
            Real learning experiences.
          </SectionTitle>
        </RevealGroup>

        {shown.length >= ROWS_FROM ? <ReviewRows reviews={shown} /> : <ReviewFan reviews={shown} />}
      </div>
    </section>
  )
}

/* ── Fewer than six: the grid, dealt in ─────────────────────────────────── */

/**
 * Each card runs its own scroll window — from its top at the viewport's
 * bottom edge to its top at 55% — so a phone's stacked cards arrive one by
 * one while a desktop row (one shared top) arrives together. A light spring
 * takes the wheel's steps out of it.
 *
 * Lanes: in a row, the outer cards come in from their own side and the
 * middle one rises from below, so no card ever crosses another's path. A
 * single column alternates left / right.
 */
function ReviewFan({ reviews }: { reviews: LandingReview[] }) {
  const ok = useMotionOK()
  const sm = useMediaQuery("(min-width: 640px)")
  const lg = useMediaQuery("(min-width: 1024px)")
  const n = reviews.length
  const cols = lg && n >= 3 ? 3 : sm && n >= 2 ? 2 : 1

  return (
    <div
      className={cn(
        "mt-10 grid grid-cols-1 gap-3 md:mt-12",
        n >= 2 && "sm:grid-cols-2",
        n >= 3 && "lg:grid-cols-3",
        // Fewer reviews: a narrower grid instead of a sparse row.
        n === 1 && "max-w-md",
        n === 2 && "max-w-3xl"
      )}
    >
      {reviews.map((review, i) => {
        const col = i % cols
        const lane =
          cols === 1 ? (i % 2 === 0 ? -1 : 1) : col === 0 ? -1 : col === cols - 1 ? 1 : 0
        return ok ? (
          <DealtCard key={review.id} lane={lane} wide={cols > 1}>
            <ReviewCard review={review} />
          </DealtCard>
        ) : (
          <ReviewCard key={review.id} review={review} />
        )
      })}
    </div>
  )
}

function DealtCard({
  lane,
  wide,
  children,
}: {
  /** -1 from the left, 1 from the right, 0 up from below. */
  lane: -1 | 0 | 1
  /** Multi-column: longer throws. A phone's single column keeps them short. */
  wide: boolean
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.55"] })
  const t = useSpring(scrollYProgress, { stiffness: 150, damping: 28, mass: 0.6 })

  const dx = lane * (wide ? 132 : 44)
  const dy = lane === 0 ? 120 : wide ? 56 : 36
  const x = useTransform(t, [0, 1], [dx, 0])
  const y = useTransform(t, [0, 1], [dy, 0])
  const rotate = useTransform(t, [0, 1], [lane * (wide ? 3.5 : 2), 0])
  const opacity = useTransform(t, [0, 0.65], [0, 1])
  // Keyboard focus can reach a card still on its way in (the browser only
  // scrolls it just into view): a focused card stands settled and lit.
  const [focused, setFocused] = React.useState(false)

  return (
    <motion.div
      ref={ref}
      className="origin-bottom"
      style={focused ? { x: 0, y: 0, rotate: 0, opacity: 1 } : { x, y, rotate, opacity }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      {children}
    </motion.div>
  )
}

/* ── Six or more: two rows, opposite directions ─────────────────────────── */

/** Extra travel past each end of a row, so even a row that fits still moves. */
const DRIFT = 64

/**
 * The rows' shared clock is the block's own pass through the viewport — top
 * at 90% of it to bottom at 10% — so every card crosses the stage while its
 * row is on screen.
 *
 * Keyboard: a card's link can receive focus while its card is off the side
 * of the stage (the browser only scrolls vertically to it). While a row holds
 * focus it stops following the scroll and glides to centre the focused card
 * (clamped to the row's travel, so no empty run shows at either end); when
 * focus leaves the row it glides back to where the scroll puts it. Focus
 * never lands on a card the reader can't see.
 */
function ReviewRows({ reviews }: { reviews: LandingReview[] }) {
  const ok = useMotionOK()
  const blockRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: blockRef, offset: ["start 0.9", "end 0.1"] })

  const half = Math.ceil(reviews.length / 2)
  const rows = [reviews.slice(0, half), reviews.slice(half)]

  if (!ok) {
    return (
      <div ref={blockRef} className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-12 lg:grid-cols-3">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    )
  }

  return (
    <div ref={blockRef} className="mt-10 space-y-3 md:mt-12">
      {rows.map((row, r) => (
        <ReviewRow key={r} reviews={row} progress={scrollYProgress} reverse={r === 1} blockRef={blockRef} />
      ))}
    </div>
  )
}

function ReviewRow({
  reviews,
  progress,
  reverse,
  blockRef,
}: {
  reviews: LandingReview[]
  progress: MotionValue<number>
  reverse: boolean
  blockRef: React.RefObject<HTMLDivElement | null>
}) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  // Where the row should be (the scroll's answer, or the held card's), and
  // the row itself following it on one light spring — which also takes the
  // wheel's steps out of the scroll-driven travel.
  const target = useMotionValue(0)
  const x = useSpring(target, { stiffness: 120, damping: 26, mass: 0.6 })
  // Travel ends in px, measured (never read in the scroll path).
  const span = React.useRef({ from: 0, to: 0 })
  // True while a card in this row holds keyboard focus: the row is parked.
  const held = React.useRef(false)

  const scrolledX = React.useCallback(
    (p: number) => span.current.from + (span.current.to - span.current.from) * p,
    []
  )
  const place = React.useCallback(
    (p: number) => {
      if (!held.current) target.set(scrolledX(p))
    },
    [target, scrolledX]
  )
  useMotionValueEvent(progress, "change", place)

  React.useEffect(() => {
    const track = trackRef.current
    const frame = blockRef.current
    if (!track || !frame) return
    const measure = () => {
      // Row A starts DRIFT right of the frame's left edge and ends with its
      // last card DRIFT inside the frame's right edge; row B runs it backwards.
      const overflow = Math.max(0, track.offsetWidth - frame.clientWidth)
      const start = DRIFT
      const end = -overflow - DRIFT
      span.current = reverse ? { from: end, to: start } : { from: start, to: end }
      if (held.current) return
      // A (re)measure lands the row directly — no glide from a stale spot.
      target.set(scrolledX(progress.get()))
      x.jump(target.get())
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(frame)
    ro.observe(track)
    return () => ro.disconnect()
  }, [blockRef, progress, reverse, target, x, scrolledX])

  const hold = (card: HTMLElement) => {
    const frame = blockRef.current
    if (!frame) return
    held.current = true
    const { from, to } = span.current
    // The x that centres this card in the viewport (the frame is the page
    // column; its left edge sits frameLeft px in), within the row's travel.
    const frameLeft = frame.getBoundingClientRect().left
    const want = (window.innerWidth - card.offsetWidth) / 2 - frameLeft - card.offsetLeft
    target.set(Math.min(Math.max(want, Math.min(from, to)), Math.max(from, to)))
  }

  const release = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    held.current = false
    target.set(scrolledX(progress.get()))
  }

  return (
    <motion.div
      ref={trackRef}
      className="flex w-max gap-3 will-change-transform"
      style={{ x }}
      onBlur={release}
    >
      {reviews.map((review) => (
        <div
          key={review.id}
          className="w-[18rem] shrink-0 sm:w-[23rem] lg:w-[26rem]"
          onFocus={(e) => hold(e.currentTarget)}
        >
          <ReviewCard review={review} />
        </div>
      ))}
    </motion.div>
  )
}

/* ── Finale ─────────────────────────────────────────────────────────────── */

/**
 * FINALE (spec §16). The closing band: hairline top border, the headline,
 * the two spec paragraphs, and the two CTAs.
 *
 * The headline is set by scroll: from the section's top at the viewport's
 * bottom edge to its top at 25%, it scales 0.88 → 1 and its two lines rise
 * into place at different rates (the gold line from further down, so the
 * pair closes up as it lands), while the gold glow behind it swells from a
 * point to its full size. The body rises with it, lagging a little more than
 * the gold line so nothing can overlap mid-rise, and keeps its one-shot
 * fade-up. Every value is complete by the time the section reaches that
 * point — and fully opaque well before it — so even a viewport too tall to
 * scroll the band that high still reads a lit, settled headline; there is
 * no dead end.
 *
 * The glow is a radial of the brand glow token (no blur filter, so scaling
 * it is a plain compositor transform) and absolutely positioned — zero
 * height, no minimum-height caverns. Reduced motion: glow at full size,
 * headline standing.
 */
export function FinaleCta({
  signedIn,
  registerUrl,
}: {
  signedIn: boolean
  registerUrl: string
}) {
  const ok = useMotionOK()
  const ref = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.25"] })
  const t = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.6 })

  // Lag grows down the column — line one, line two, then the body — so a
  // gap can only open during the rise, never close into an overlap.
  const headScale = useTransform(t, [0, 1], [0.88, 1])
  const lineOneY = useTransform(t, [0, 1], [56, 0])
  const lineTwoY = useTransform(t, [0, 1], [80, 0])
  const bodyY = useTransform(t, [0, 1], [92, 0])
  const lineOneOpacity = useTransform(t, [0.05, 0.5], [0, 1])
  const lineTwoOpacity = useTransform(t, [0.15, 0.6], [0, 1])
  const glowScale = useTransform(t, [0, 1], [0.3, 1])
  const glowOpacity = useTransform(t, [0, 0.7], [0, 1])

  return (
    // `id="finale"`: the sticky school bar hides while this band is in view.
    <section
      ref={ref}
      id="finale"
      className="relative isolate overflow-hidden border-t border-ws-hairline py-24 text-center md:py-32"
    >
      {/* Still values (not `undefined`) when motion is off: motion keeps the
          last inline value it wrote, and the first client pass always runs
          with motion on — so dropping the style would strand the headline
          at its opacity-0 start. */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-[42%] h-[36rem] w-[70rem] max-w-[180vw] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(closest-side, var(--ws-glow-brand), var(--ws-glow-brand) 30%, transparent)",
          ...(ok ? { scale: glowScale, opacity: glowOpacity } : { scale: 1, opacity: 1 }),
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6">
        <motion.h2
          className="font-display text-[clamp(2rem,4.6vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-balance text-ws-primary"
          style={{ scale: ok ? headScale : 1 }}
        >
          <motion.span
            className="block"
            style={ok ? { y: lineOneY, opacity: lineOneOpacity } : { y: 0, opacity: 1 }}
          >
            Your next level starts with
          </motion.span>
          <motion.span
            className="block text-ws-gold"
            style={ok ? { y: lineTwoY, opacity: lineTwoOpacity } : { y: 0, opacity: 1 }}
          >
            what you learn today.
          </motion.span>
        </motion.h2>
        <motion.div style={{ y: ok ? bodyY : 0 }}>
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
          {/* Phones: one column of equal-width buttons, not two ragged centred pills. */}
          <Reveal
            amount={0.2}
            delay={0.2}
            className="mx-auto mt-9 flex max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center"
          >
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
        </motion.div>
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
