"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { MarketingCourseCard } from "@/components/marketing/course-card"
import { Marquee } from "@/components/marketing/motion/marquee"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import type { BrowseCourse } from "@/lib/actions/student"

/**
 * FEATURED PROGRAMS — the catalogue. One gold panel (the page's only
 * primary-background surface): hero copy + tagline + a black CTA on the left,
 * and the live course cards in TWO ROWS on the right.
 *
 * The panel GROWS as it scrolls in: it enters as an inset card with rounded
 * corners and, by the time its top edge reaches the upper quarter of the
 * viewport, it has opened out to the full width of the window, corners
 * squared — a clip-path scrubbed by scroll (through a light spring), so the
 * layout never moves and the text is never scaled. The content sits inside
 * the card's starting inset, so it is fully visible at every step; only the
 * gold grows around it. Its two rows of programs drift vertically at
 * slightly different scroll-linked rates (the top row ±30px, the bottom row
 * ±14px, both lagging the page a touch), so the panel reads as depth, not a
 * flat slab — and the cards are already in place as the gold arrives, so it
 * never enters as an empty gold block.
 *
 * The rows also drift sideways on their own (owner call, 2026-09-16: nobody
 * should have to paddle through the catalogue with arrow buttons). Each row
 * is a Marquee on the shared rAF bus: opposing directions at unequal speeds
 * so the rows never phase-lock, a 600ms ramp-in on entry, and a row STOPS the
 * moment the pointer or keyboard focus is on it, so every card stays
 * clickable. Off-screen rows schedule no frames. The rows run out to the
 * panel's right edge, masked, so cards dissolve rather than stop dead.
 *
 * Where drift is the wrong answer the old rail stays: reduced motion (the
 * house rule) and coarse pointers (a phone cannot hover to pause a row, and a
 * swipe is the natural gesture there), each with prev/next paging. Below lg
 * the panel stacks: copy first, then the rows full-bleed to the panel's edges.
 * Reduced motion also keeps the panel a still, inset card — no growth.
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
  if (courses.length < 3) return null
  return <CataloguePanel courses={courses} signedIn={signedIn} />
}

/**
 * The panel's starting inset, per breakpoint, as CSS custom properties the
 * clip-path multiplies by the remaining growth (1 → 0): x = side inset,
 * y = top/bottom inset, r = corner radius. `--pad-x` is what the content's
 * own padding adds on top: the full inset while the panel grows (so nothing
 * is ever clipped), zero when the panel is simply a still inset card.
 */
const GROW_VARS =
  "[--grow-x:1rem] [--grow-y:0.5rem] [--grow-r:1.25rem] sm:[--grow-x:1.5rem] sm:[--grow-r:1.75rem] lg:[--grow-x:max(2.5rem,5.5vw)] lg:[--grow-y:1.75rem] lg:[--grow-r:2.25rem]"

function clipAt(k: number | string): string {
  return `inset(calc(${k} * var(--grow-y)) calc(${k} * var(--grow-x)) round calc(${k} * var(--grow-r)))`
}

/**
 * Reduced motion: the same inset card, but made of real margins and a real
 * radius rather than a clip — so the paging rail's scroll box ends at the
 * card's edge and a focused card is never hidden under a clip.
 */
const STILL_CARD: React.CSSProperties = {
  // Explicit: the server pass (and the first client pass) rendered the
  // growing clip, and motion leaves a style it no longer receives in place.
  clipPath: "none",
  marginInline: "var(--grow-x)",
  marginBlock: "var(--grow-y)",
  borderRadius: "var(--grow-r)",
}

function CataloguePanel({ courses, signedIn }: { courses: BrowseCourse[]; signedIn: boolean }) {
  const ok = useMotionOK()
  const coarse = useMediaQuery("(pointer: coarse)")
  const panelRef = React.useRef<HTMLDivElement>(null)

  // Growth: inset card at the viewport's bottom edge → full-bleed with its
  // top at 25% of the viewport. Gently eased out, so the opening is visible
  // through the whole entry and the last few pixels settle.
  const grow = useScroll({ target: panelRef, offset: ["start end", "start 0.25"] })
  const g = useSpring(grow.scrollYProgress, { stiffness: 170, damping: 30, mass: 0.5 })
  const clipPath = useTransform(g, (v) => {
    const k = Math.pow(1 - Math.min(Math.max(v, 0), 1), 1.25)
    return k < 0.001 ? "inset(0px round 0px)" : clipAt(k.toFixed(4))
  })

  // Row drift over the panel's whole pass through the viewport. The rows lag
  // the page slightly (they start high and settle low), the top row a little
  // more than the bottom one — so the cards sit close under the panel's top
  // edge as it arrives, and the two rows part and close by ±16px, never touching.
  const pass = useScroll({ target: panelRef, offset: ["start end", "end start"] })
  const rowTop = useTransform(pass.scrollYProgress, [0, 1], [-30, 30])
  const rowBottom = useTransform(pass.scrollYProgress, [0, 1], [-14, 14])

  return (
    <section className="relative isolate pb-16 pt-10 md:pb-24 md:pt-14">
      <motion.div
        ref={panelRef}
        className={`relative overflow-hidden bg-ws-brand lg:grid lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:items-center ${GROW_VARS} ${ok ? "[--pad-x:var(--grow-x)]" : "[--pad-x:0px]"}`}
        style={ok ? { clipPath } : STILL_CARD}
      >
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
        <div className="relative px-[calc(var(--pad-x)+1.5rem)] pb-2 pt-12 sm:px-[calc(var(--pad-x)+3rem)] sm:pt-16 lg:py-24 lg:pl-[calc(var(--pad-x)+2.5rem)] lg:pr-8">
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
          <DriftingRows courses={courses} signedIn={signedIn} rowY={[rowTop, rowBottom]} />
        ) : (
          <ScrollRail courses={courses} signedIn={signedIn} />
        )}
      </motion.div>
    </section>
  )
}

/** Drift speeds, px/s — opposing directions, deliberately unequal so the two rows never phase-lock. */
const ROW_SPEEDS = [26, 19] as const

/** The card width in both rows; the card fills whatever width its slot gives it. */
const CARD = "w-[14.5rem] shrink-0 sm:w-[17rem]"

/** The rows fade out over the last few rem on each side rather than stopping dead at the column. */
const EDGE_MASK = "linear-gradient(to right, transparent 0%, #000 8%, #000 94%, transparent 100%)"

function DriftingRows({
  courses,
  signedIn,
  rowY,
}: {
  courses: BrowseCourse[]
  signedIn: boolean
  rowY: [MotionValue<number>, MotionValue<number>]
}) {
  // Cards fill down then across, as the old grid did: evens on top, odds below.
  const rows = [courses.filter((_, i) => i % 2 === 0), courses.filter((_, i) => i % 2 === 1)]
  // No fade-in here: the panel's growth is the entrance, and the cards are
  // already in place as the gold arrives — never an empty gold block.
  return (
    <div className="relative min-w-0 py-8 sm:py-10 lg:py-16">
      <div
        aria-label="Program catalogue"
        className="flex flex-col gap-3.5 sm:gap-5"
        style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
      >
        {rows.map((row, r) => (
          <motion.div key={r} style={{ y: rowY[r] }}>
            <Marquee speed={ROW_SPEEDS[r]} direction={r === 0 ? "left" : "right"}>
              {row.map((course) => (
                <MarketingCourseCard key={course.id} course={course} signedIn={signedIn} className={CARD} />
              ))}
            </Marquee>
          </motion.div>
        ))}
      </div>
    </div>
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
        className="grid auto-cols-[14.5rem] grid-flow-col grid-rows-2 gap-3.5 overflow-x-auto px-[calc(var(--pad-x)+1.5rem)] py-8 [-ms-overflow-style:none] [scrollbar-width:none] sm:auto-cols-[17rem] sm:gap-5 sm:px-[calc(var(--pad-x)+3rem)] sm:py-10 lg:py-16 lg:pl-2 lg:pr-[calc(var(--pad-x)+3rem)] [&::-webkit-scrollbar]:hidden"
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
      <div className="flex items-center justify-end gap-2 px-[calc(var(--pad-x)+1.5rem)] pb-8 sm:px-[calc(var(--pad-x)+3rem)] sm:pb-10 lg:pb-16 lg:pr-[calc(var(--pad-x)+3rem)]">
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
