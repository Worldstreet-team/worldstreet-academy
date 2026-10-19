"use client"
import { ArrowRightIcon } from "@/components/icons"

import * as React from "react"

import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
import type { SchoolSlug } from "@/lib/schools"
import { SCHOOLS } from "@/lib/schools"
import { BRAND } from "@/lib/brand"
import { SchoolPanel } from "@/components/marketing/school-panel"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

const TOTAL = SCHOOLS.length
const LAST = TOTAL - 1

/** The sticky navbar's height from `sm` (h-16) — the lg stage pins under it (`top-16`). */
const NAV = 64

/**
 * The stage's geometry, in CSS so the server HTML is already the pinned
 * layout (no post-hydration jump in page height).
 *
 * lg+ — the `lg:motion-safe:` classes:
 *
 *   gut    the page container's left edge (max-w-7xl, px-6)
 *   head   the heading column the first panel sits beside
 *   gap    heading → first panel
 *   g      between panels
 *   p      a panel's width: whatever is left of the viewport after the
 *          heading, less ~4.5rem so the next panel peeks on the first frame
 *   h      a panel's height: 70vh, kept clear of the navbar and the sticky
 *          school bar on short screens
 *   travel how far the row slides: its full width less one viewport
 *   height the section: one stage plus the travel at ~0.58px of scroll per
 *          px of slide (0.66 less the two dwells) — each school gets a bit
 *          over half a viewport of scroll (~470px at 1280×800), about one
 *          viewport per 1.7 panels: a beat to read it, never a paddle
 *
 * Phones and tablets held upright — the `max-lg:portrait:motion-safe:`
 * classes. Nothing fits beside the heading there, and a heading held on
 * stage would leave a short phone a card too small to read, so the heading
 * stays in the page and scrolls away first; then the row's own box pins
 * under the navbar and the stage belongs to the cards:
 *
 *   cw     a card's width: 84vw, so the next card peeks (~20px at 390);
 *          30rem at most, so a tablet keeps the panel's stacked composition
 *          (its full-bleed one, from 32rem, needs a landscape panel: on a
 *          near-square one the copy column lands on the render)
 *   ch     a card's height, at most: 1.7 × its width (40rem cap). The box
 *          shrinks it on short phones — it always clears the sticky school
 *          bar at the viewport's foot
 *   run    how long the box stays pinned: 66svh per card after the first —
 *          each school gets a bit over half a screen of scroll (~490px at
 *          390×844). svh, never vh or dvh, so iOS's URL bar can't resize the
 *          pinned box mid-run
 *
 * Held sideways below lg (a phone in landscape has no height for a stage),
 * the swipe row stays.
 */
const GEOMETRY = {
  "--sch-n": TOTAL,
  "--sch-gut": "max(1.5rem, calc(50vw - 38.5rem))",
  "--sch-head": "clamp(17rem, calc(22vw + 4rem), 24rem)",
  "--sch-gap": "3rem",
  "--sch-g": "1.5rem",
  "--sch-p": "min(70rem, calc(100vw - var(--sch-gut) - var(--sch-head) - var(--sch-gap) - 4.5rem))",
  "--sch-h": "min(70vh, calc(100vh - 15rem))",
  "--sch-lead": "calc(var(--sch-gut) + var(--sch-head) + var(--sch-gap))",
  "--sch-travel":
    "calc(var(--sch-lead) + var(--sch-n) * var(--sch-p) + (var(--sch-n) - 1) * var(--sch-g) + var(--sch-gut) - 100vw)",
  "--sch-height": `calc(100vh - ${NAV / 16}rem + var(--sch-travel) * 0.66)`,
  "--sch-cw": "min(84vw, 30rem)",
  "--sch-ch": "min(calc(var(--sch-cw) * 1.7), 40rem)",
  "--sch-run": "calc((var(--sch-n) - 1) * 66svh)",
} as React.CSSProperties

/** A light spring over the raw progress — takes the wheel's steps out of the slide without lagging it. */
const SLIDE_SPRING = { stiffness: 300, damping: 40, mass: 0.5 }

/**
 * Dwells: the stage holds still for the first 7% of the pinned run (~260px
 * at 1280×800 — the first frame, whole) and the last 5%, so the turn from
 * vertical to horizontal travel (and back) reads as a beat rather than a
 * lurch.
 */
const DWELL_IN = 0.07
const DWELL_OUT = 0.05

/**
 * The heading leads the row out: it travels with the track at this share of
 * its speed (a step behind — farther back) and is gone before the gap to
 * panel 01 can close, so no panel ever slides over live heading text.
 */
const HEAD_LAG = 0.92

/**
 * OUR SCHOOLS (spec §4) — the landing's signature moment.
 *
 * lg+ with motion: a pinned horizontal showcase. The section is tall; a
 * sticky stage under the navbar holds still while vertical scroll slides a
 * row of seven large panels (`SchoolPanel`) across it. On the first frame
 * the heading sits at the stage's left with the first panel beside it and
 * the second peeking; as the row moves, the heading leads it out — a step
 * slower, fading — and is gone before panel 01 could reach it, so no panel
 * ever covers live heading text. A counter ("03 / 08", rolling) and a thin
 * rule track the run under the heading column, clear of the sticky school
 * bar. Keyboard: panels are links; one reached by Tab scrolls the window to
 * the point that puts it on stage.
 *
 * Below lg, held upright, with motion: the same run, composed for a narrow
 * screen. The heading reads first and scrolls away; the row's box pins under
 * the navbar with one card on stage and the next peeking, slides the seven
 * across, then lets go. The counter and rule sit under the card, clear of
 * the sticky school bar.
 *
 * Reduced motion, or a phone held sideways: the heading above a native swipe
 * row with scroll-snap — no pinning, no scrubbing, no page overflow.
 *
 * Which layout applies is decided in CSS (`lg:motion-safe:`,
 * `max-lg:portrait:motion-safe:`), and the JS wiring (`pinned`) switches on
 * only after hydration under the same conditions, so server and first client
 * render always agree.
 */
export function SchoolsGrid({
  counts,
  cheapest,
}: {
  counts: Record<SchoolSlug, number>
  cheapest: Record<SchoolSlug, number | null>
}) {
  const ok = useMotionOK()
  const lg = useMediaQuery("(min-width: 1024px)")
  const compact = useMediaQuery("(max-width: 1023.98px) and (orientation: portrait)")
  const pinned = ok && (lg || compact)

  const sectionRef = React.useRef<HTMLElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLUListElement>(null)
  const runRef = React.useRef<HTMLDivElement>(null)

  // lg: 0 when the section's top reaches the navbar (the stage pins), 1 when
  // its bottom reaches the viewport's (the stage lets go). Compact: the run
  // is the spacer under the pinned box — 0 as its top enters the viewport's
  // foot (the box pins), 1 as its bottom does (the box lets go).
  const { scrollYProgress } = useScroll({
    target: lg ? sectionRef : runRef,
    offset: lg ? [`start ${NAV}px`, "end end"] : ["start end", "end end"],
  })
  const progress = useSpring(scrollYProgress, SLIDE_SPRING)
  const slide = useTransform(progress, [DWELL_IN, 1 - DWELL_OUT], [0, 1])
  const active = useTransform(slide, (v) => v * LAST)

  // How far the row slides — measured, never read in the scroll path.
  const travel = useMotionValue(0)
  React.useEffect(() => {
    if (!pinned) return
    const stage = stageRef.current
    const track = trackRef.current
    if (!stage || !track) return
    const measure = () => travel.set(Math.max(0, track.offsetWidth - stage.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    ro.observe(track)
    return () => ro.disconnect()
  }, [pinned, travel])
  const x = useTransform(() => -slide.get() * travel.get())

  // The heading leaves with the row, a step slower, and is gone by active
  // 0.4 (~180px of scroll at 1280×800) — while the 3rem gap to panel 01 is
  // still open (at HEAD_LAG 0.92 it would close near 0.74 at 1280, 0.55 at
  // 1920), so the two never overlap.
  const headOpacity = useTransform(active, [0.02, 0.4], [1, 0])
  const headX = useTransform(() => x.get() * HEAD_LAG)

  /** Tab onto a panel → scroll to where it is on stage (keyboard only; a click never jumps). */
  const focusPanel = (i: number) => (e: React.FocusEvent<HTMLAnchorElement>) => {
    const run = lg ? sectionRef.current : runRef.current
    if (!pinned || !run || !e.currentTarget.matches(":focus-visible")) return
    // The same two points `useScroll` measures between.
    const top = run.getBoundingClientRect().top + window.scrollY
    const start = lg ? top - NAV : top - window.innerHeight
    const end = top + run.offsetHeight - window.innerHeight
    const at = DWELL_IN + (i / LAST) * (1 - DWELL_IN - DWELL_OUT)
    window.scrollTo({ top: start + at * (end - start), behavior: "smooth" })
  }

  return (
    <section
      id="schools"
      ref={sectionRef}
      style={GEOMETRY}
      aria-labelledby="schools-heading"
      className="relative scroll-mt-24 py-14 [--sch-nav:3.5rem] sm:py-20 sm:[--sch-nav:4rem] md:py-28 lg:motion-safe:h-[var(--sch-height)] lg:motion-safe:scroll-mt-16 lg:motion-safe:py-0 max-lg:portrait:motion-safe:pb-0"
    >
      <div
        ref={stageRef}
        className="lg:motion-safe:sticky lg:motion-safe:top-16 lg:motion-safe:flex lg:motion-safe:h-[calc(100vh-4rem)] lg:motion-safe:flex-col lg:motion-safe:justify-center lg:motion-safe:overflow-clip lg:motion-safe:pb-16 max-lg:portrait:motion-safe:overflow-clip"
      >
        <div className="relative lg:motion-safe:h-[var(--sch-h)]">
          {/* Heading — above the row; at the stage's left, under the sliding row, when pinned at lg. */}
          <div className="mx-auto max-w-7xl px-6 lg:motion-safe:absolute lg:motion-safe:inset-0">
            <motion.div
              style={pinned && lg ? { opacity: headOpacity, x: headX } : { opacity: 1, x: 0 }}
              className="lg:motion-safe:flex lg:motion-safe:h-full lg:motion-safe:w-[var(--sch-head)] lg:motion-safe:flex-col lg:motion-safe:justify-between"
            >
              <RevealGroup>
                <SectionLabel>Our schools</SectionLabel>
                <SectionTitle id="schools-heading" className="mt-4 max-w-2xl">
                  Explore the Schools of {BRAND.name}
                </SectionTitle>
                <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
                  Your future can take many directions. Choose the school that matches
                  your interests, goals and ambitions.
                </p>
              </RevealGroup>
              <Reveal
                delay={0.3}
                className="hidden items-center gap-2 text-[13px] font-semibold text-ws-muted lg:motion-safe:flex"
              >
                Scroll to explore
                <ArrowRightIcon size={14} aria-hidden />
              </Reveal>
            </motion.div>
          </div>

          {/* The row — a swipe row, or the track sliding across the stage. Compact: its
              box is the stage — pinned under the navbar, the card centred between the
              navbar and the sticky school bar (4.5rem + its safe-area foot). */}
          <Reveal
            y={20}
            duration={0.65}
            amount={0.05}
            className="lg:motion-safe:relative lg:motion-safe:z-10 lg:motion-safe:h-full max-lg:portrait:motion-safe:sticky max-lg:portrait:motion-safe:top-[var(--sch-nav)] max-lg:portrait:motion-safe:flex max-lg:portrait:motion-safe:h-[calc(100svh_-_var(--sch-nav))] max-lg:portrait:motion-safe:flex-col max-lg:portrait:motion-safe:justify-center max-lg:portrait:motion-safe:pt-4 max-lg:portrait:motion-safe:pb-[calc(4.5rem_+_max(1rem,env(safe-area-inset-bottom)))]"
          >
            <motion.ul
              ref={trackRef}
              style={pinned ? { x } : undefined}
              className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-[var(--sch-gut)] pb-3 scroll-px-[var(--sch-gut)] [scrollbar-width:thin] md:mt-12 lg:motion-safe:mt-0 lg:motion-safe:h-full lg:motion-safe:w-max lg:motion-safe:snap-none lg:motion-safe:gap-[var(--sch-g)] lg:motion-safe:overflow-visible lg:motion-safe:pb-0 lg:motion-safe:pl-[var(--sch-lead)] lg:motion-safe:pr-[var(--sch-gut)] lg:motion-safe:will-change-transform max-lg:portrait:motion-safe:mt-0 max-lg:portrait:motion-safe:min-h-0 max-lg:portrait:motion-safe:w-max max-lg:portrait:motion-safe:basis-[var(--sch-ch)] max-lg:portrait:motion-safe:snap-none max-lg:portrait:motion-safe:overflow-visible max-lg:portrait:motion-safe:pb-0 max-lg:portrait:motion-safe:will-change-transform"
            >
              {SCHOOLS.map((school, i) => (
                <li
                  key={school.slug}
                  className="w-[min(82vw,22rem)] shrink-0 snap-start sm:w-[24rem] lg:motion-reduce:w-[26rem] lg:motion-safe:h-full lg:motion-safe:w-[var(--sch-p)] max-lg:portrait:motion-safe:h-full max-lg:portrait:motion-safe:w-[var(--sch-cw)]"
                >
                  <SchoolPanel
                    school={school}
                    index={i}
                    count={counts[school.slug]}
                    fromPrice={cheapest[school.slug]}
                    stage={pinned ? active : undefined}
                    onFocus={focusPanel(i)}
                  />
                </li>
              ))}
            </motion.ul>

            {/* Where you are in the run — compact: under the card, on its left edge. */}
            <div aria-hidden className="hidden shrink-0 px-[var(--sch-gut)] max-lg:portrait:motion-safe:block">
              <RunMeter slide={slide} active={active} />
            </div>
          </Reveal>

          {/* Compact: the scroll the box stays pinned for. */}
          <div ref={runRef} aria-hidden className="hidden h-[var(--sch-run)] max-lg:portrait:motion-safe:block" />
        </div>

        {/* Where you are in the run — lg: under the heading column, clear of the centred sticky school bar. */}
        <div aria-hidden className="mx-auto hidden w-full max-w-7xl px-6 lg:motion-safe:block">
          <RunMeter slide={slide} active={active} />
        </div>
      </div>
    </section>
  )
}

/** "03 / 08" — the current number rolls like an odometer — beside a thin rule that fills with the run. */
function RunMeter({ slide, active }: { slide: MotionValue<number>; active: MotionValue<number> }) {
  const index = useTransform(active, (v) => Math.round(v))
  const roll = useSpring(index, { stiffness: 260, damping: 30 })
  const y = useTransform(roll, (v) => `${(-v * 100) / TOTAL}%`)

  return (
    <div className="mt-6 flex items-center gap-4 text-[13px] font-semibold tabular-nums">
      <span className="flex items-center gap-1.5">
        <span className="relative block h-5 overflow-hidden leading-5 text-ws-primary">
          <motion.span className="block" style={{ y }}>
            {SCHOOLS.map((s, i) => (
              <span key={s.slug} className="block h-5">
                {String(i + 1).padStart(2, "0")}
              </span>
            ))}
          </motion.span>
        </span>
        <span className="text-ws-subtle">/ {String(TOTAL).padStart(2, "0")}</span>
      </span>
      <span className="relative h-px w-40 overflow-hidden bg-ws-hairline">
        <motion.span className="absolute inset-0 origin-left bg-ws-primary" style={{ scaleX: slide }} />
      </span>
    </div>
  )
}
