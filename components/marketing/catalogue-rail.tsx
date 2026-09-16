"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { MarketingCourseCard } from "@/components/marketing/course-card"
import { Marquee } from "@/components/marketing/motion/marquee"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import type { BrowseCourse } from "@/lib/actions/student"

/**
 * FEATURED PROGRAMS — the catalogue. One near-full-bleed gold panel (the page's
 * only primary-background surface): hero copy + tagline + a black CTA on the
 * left, and the live course cards in TWO ROWS on the right.
 *
 * The rows drift on their own (owner call, 2026-09-16: nobody should have to
 * paddle through the catalogue with arrow buttons). Each row is a Marquee on
 * the shared rAF bus — the same mechanics as the hero wall and the band of
 * words: opposing directions at unequal speeds so the rows never phase-lock,
 * a 600ms ramp-in on entry, and a row STOPS the moment the pointer or
 * keyboard focus is on it, so every card stays clickable. Off-screen rows
 * schedule no frames. The container edges are masked, so cards dissolve into
 * the gold instead of being cut off at the column.
 *
 * Where drift is the wrong answer the old rail stays: reduced motion (the
 * house rule) and coarse pointers (a phone cannot hover to pause a row, and a
 * swipe is the natural gesture there), each with prev/next paging. Below lg
 * the panel stacks: copy first, then the rows full-bleed to the panel's edges.
 *
 * A dot mesh sits over the panel's left half at 70%, masked out toward the
 * rows so it never fights the copy.
 */
export function CatalogueGrid({
  courses,
  signedIn,
}: {
  courses: BrowseCourse[]
  signedIn: boolean
}) {
  const ok = useMotionOK()
  const coarse = useMediaQuery("(pointer: coarse)")

  if (courses.length < 3) return null

  return (
    <section className="relative isolate py-16 md:py-24">
      <div className="mx-auto w-full max-w-[112rem] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-ws-brand sm:rounded-3xl lg:grid lg:grid-cols-[0.36fr_0.64fr] lg:items-center">
          {/* Dot mesh — left half, 70%, dissolving toward the rows. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-full opacity-70 lg:w-1/2"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(0,0,0,0.5) 1.5px, transparent 1.5px)",
              backgroundSize: "20px 20px",
              maskImage: "linear-gradient(to right, black, transparent 85%)",
              WebkitMaskImage: "linear-gradient(to right, black, transparent 85%)",
            }}
          />

          {/* Left — the pitch */}
          <div className="relative px-6 pb-2 pt-10 sm:px-12 sm:pt-16 lg:py-24 lg:pl-16 lg:pr-8">
            <RevealGroup>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ws-brand-on/70">
                Featured programs
              </p>
              <h2
                className="mt-4 max-w-lg font-display font-semibold leading-[1.02] tracking-[-0.03em] text-ws-brand-on sm:mt-5"
                style={{ fontSize: "clamp(2rem, 4.4vw, 4.25rem)" }}
              >
                Browse it all before you sign up.
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ws-brand-on/75 sm:mt-5 sm:text-[16px] md:text-[17px]">
                Straight from the live catalogue — levels and prices as they are.
              </p>
              <Link
                href="/programs"
                className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-black px-8 text-[15px] font-semibold text-white transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-85 sm:mt-9 sm:h-13 sm:px-9"
              >
                Browse all programs
              </Link>
            </RevealGroup>
          </div>

          {/* Right — the two rows */}
          {ok && !coarse ? (
            <DriftingRows courses={courses} signedIn={signedIn} />
          ) : (
            <ScrollRail courses={courses} signedIn={signedIn} />
          )}
        </div>
      </div>
    </section>
  )
}

/** Drift speeds, px/s — opposing directions, deliberately unequal so the two rows never phase-lock. */
const ROW_SPEEDS = [26, 19] as const

/** The card width in both rows; the card fills whatever width its slot gives it. */
const CARD = "w-[14.5rem] shrink-0 sm:w-[17rem]"

/** The rows fade out over the last few rem on each side rather than stopping dead at the column. */
const EDGE_MASK = "linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)"

function DriftingRows({ courses, signedIn }: { courses: BrowseCourse[]; signedIn: boolean }) {
  // Cards fill down then across, as the old grid did: evens on top, odds below.
  const rows = [courses.filter((_, i) => i % 2 === 0), courses.filter((_, i) => i % 2 === 1)]
  return (
    <Reveal y={24} duration={0.7} className="relative min-w-0 py-8 sm:py-10 lg:py-16">
      <div
        aria-label="Program catalogue"
        className="flex flex-col gap-3.5 sm:gap-5"
        style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
      >
        {rows.map((row, r) => (
          <Marquee key={r} speed={ROW_SPEEDS[r]} direction={r === 0 ? "left" : "right"}>
            {row.map((course) => (
              <MarketingCourseCard key={course.id} course={course} signedIn={signedIn} className={CARD} />
            ))}
          </Marquee>
        ))}
      </div>
    </Reveal>
  )
}

/**
 * The manual rail: grid-flow-col, two rows, cards filling down then marching
 * sideways. Prev/next page it by its visible width; it is swipeable and
 * keyboard-scrollable, and it resolves into the full catalogue.
 */
function ScrollRail({ courses, signedIn }: { courses: BrowseCourse[]; signedIn: boolean }) {
  const railRef = React.useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = React.useState(true)
  const [atEnd, setAtEnd] = React.useState(false)

  const syncEdges = React.useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    setAtStart(rail.scrollLeft <= 4)
    setAtEnd(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4)
  }, [])

  React.useEffect(() => {
    syncEdges()
    window.addEventListener("resize", syncEdges)
    return () => window.removeEventListener("resize", syncEdges)
  }, [syncEdges])

  function page(direction: 1 | -1) {
    const rail = railRef.current
    if (!rail) return
    // One viewport of cards per press, minus a sliver so the next card peeks.
    rail.scrollBy({ left: direction * (rail.clientWidth - 64), behavior: "smooth" })
  }

  return (
    <Reveal y={24} duration={0.7} className="relative min-w-0">
      <div
        ref={railRef}
        onScroll={syncEdges}
        className="grid auto-cols-[14.5rem] grid-flow-col grid-rows-2 gap-3.5 overflow-x-auto px-6 py-8 [-ms-overflow-style:none] [scrollbar-width:none] sm:auto-cols-[17rem] sm:gap-5 sm:px-12 sm:py-10 lg:py-16 lg:pl-2 lg:pr-12 [&::-webkit-scrollbar]:hidden"
        aria-label="Program catalogue"
      >
        {courses.map((course) => (
          <MarketingCourseCard
            key={course.id}
            course={course}
            signedIn={signedIn}
            className="h-full w-full snap-start"
          />
        ))}
        {/* End-cap: the rail resolves into the full catalogue. */}
        <Link
          href="/programs"
          className="row-span-2 flex w-[10rem] snap-start items-center justify-center rounded-xl border border-black/25 text-[15px] font-semibold text-ws-brand-on transition-colors duration-[var(--ws-motion-fast)] hover:bg-black/10 sm:w-[12rem]"
        >
          View all →
        </Link>
      </div>

      {/* Paging controls — under the rail, inside the panel. */}
      <div className="flex items-center justify-end gap-2 px-6 pb-8 sm:px-12 sm:pb-10 lg:pb-16 lg:pr-12">
        <button
          type="button"
          aria-label="Previous programs"
          onClick={() => page(-1)}
          disabled={atStart}
          className="flex size-11 items-center justify-center rounded-full border border-black/25 text-ws-brand-on transition-[background-color,opacity] duration-[var(--ws-motion-fast)] hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 disabled:pointer-events-none disabled:opacity-35"
        >
          <ChevronLeftIcon size={18} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="More programs"
          onClick={() => page(1)}
          disabled={atEnd}
          className="flex size-11 items-center justify-center rounded-full bg-black text-white transition-[opacity] duration-[var(--ws-motion-fast)] hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 disabled:pointer-events-none disabled:opacity-35"
        >
          <ChevronRightIcon size={18} aria-hidden />
        </button>
      </div>
    </Reveal>
  )
}
