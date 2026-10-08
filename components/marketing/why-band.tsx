"use client"
import { CompassIcon, GaugeIcon, GraduationCapIcon, HammerIcon, TrendingUpIcon, UsersIcon, type IconComponent } from "@/components/icons"

import * as React from "react"
import {
  easeOut,
  motion,
  motionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "motion/react"
import { Reveal } from "@/components/marketing/motion/reveal"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

/**
 * WHY (spec §3) — the six pillars as a deck. Cards slide up and pile onto each
 * other, each leaving a 10–14px edge showing. As a card arrives the cards
 * beneath it settle back: the one directly under it scales to 0.94 and dims,
 * the deeper ones a little further, so the pile reads as depth rather than a
 * stack of equal slabs. Everything is a function of scroll position — scroll
 * back up and the deck deals itself out again.
 *
 * lg+ — the flow deck: each card is `position: sticky` a little lower than the
 * one before it, beside a sticky left column holding the heading, the
 * "Because the world is changing" lede and a quiet counter for the card on top.
 *
 * Below lg — the pinned deck (owner, 2026-09-21: taller cards, and the deck
 * held in the middle of the screen while it deals). The heading scrolls in
 * above; then a stage pins with the deck centred between the navbar and the
 * sticky school bar, card 01 already on it. Native scroll carries on down a
 * tall runway while 02 → 06 rise from below the screen one at a time and
 * land on the pile; after 06 has held a beat, the runway ends and the stage
 * scrolls away with the page. No wheel or touch handling — sticky and
 * scroll progress only. A landscape phone, too short to hold a card between
 * the bars, gets the cards as a plain list (`useDeckMode`).
 *
 * The layout is decided in CSS (media-query classes over the `--why-*`
 * geometry below), so the server HTML is already the phone layout and the
 * page height never moves on hydration; the JS only writes progress.
 *
 * Cards are v2 cards (04-components → Card): `surface` fill, 20px corners,
 * separated by fill in dark and a hairline in light. The gold is confined to
 * the icon chip's wash. Copy is §3 verbatim.
 *
 * Reduced motion: no sticking, no scrub — the six cards stand in a plain grid.
 */
const PILLARS: readonly { icon: IconComponent; title: string; line: string }[] = [
  {
    icon: GraduationCapIcon,
    title: "Learn From Experts",
    line: "Learn from experienced instructors and practitioners across different fields.",
  },
  {
    icon: HammerIcon,
    title: "Practical Learning",
    line: "Go beyond theory with practical lessons, assignments, projects and real-world applications.",
  },
  {
    icon: CompassIcon,
    title: "Multiple Career Paths",
    line: "Explore technology, financial markets, digital business, creative skills and emerging industries.",
  },
  {
    icon: GaugeIcon,
    title: "Learn at Your Level",
    line: "Whether you're starting from zero or looking to advance your existing knowledge, choose a program that fits your level.",
  },
  {
    icon: UsersIcon,
    title: "Mentorship & Community",
    line: "Where included, receive access to instructors, mentorship, community learning and guided support.",
  },
  {
    icon: TrendingUpIcon,
    title: "Learn. Apply. Grow.",
    line: "The objective isn't simply to finish a course. It's to develop knowledge you can actually apply.",
  },
]

const N = PILLARS.length
const TOTAL = String(N).padStart(2, "0")

/**
 * lg+ flow-deck geometry, in px. `base` = where the first card sticks (the
 * 64px navbar + air), `step` = how much lower each next card sticks, `card` =
 * the cards' min height (the class lists below must agree).
 */
const FLOW = { base: 64 + 32, step: 14, card: 272 } as const

/**
 * The pinned run below lg, in viewport heights (svh) of scroll: a short lead
 * with card 01 alone and centred; then one segment per newcomer (02 … 06),
 * the first `slide` share of it rising onto the pile and the rest a beat to
 * read it; then a hold on the finished pile before the stage lets go. Each
 * card gets 0.56 of a viewport (~470px on an 844px phone).
 */
const RUN = { lead: 0.12, seg: 0.56, slide: 0.8, hold: 0.3 } as const
const RUN_TOTAL = RUN.lead + (N - 2) * RUN.seg + RUN.slide * RUN.seg + RUN.hold

/**
 * Which deck this screen gets. `flow` at lg+. `pinned` below lg on a screen
 * tall enough to hold a card between the navbar and the school bar — its
 * classes carry that as their variant, `max-lg:[@media(min-height:32.51rem)]:`
 * (Tailwind's `max-lg` plus the height). A landscape phone (≤ 32.5rem tall)
 * has a ~200px strip there, too little for a card, so it gets `list`: the
 * cards stacked in flow, nothing pinned or settling. The CSS decides the
 * layout; this JS twin only picks which progress to write.
 */
function useDeckMode(): "pinned" | "flow" | "list" {
  // Post-hydration queries (false on the server), so server and first client
  // render assume the pinned deck — the phone majority, and what the CSS
  // already lays out there.
  const lg = useMediaQuery("(min-width: 64rem)")
  const short = useMediaQuery("not all and (min-height: 32.51rem)")
  return lg ? "flow" : short ? "list" : "pinned"
}

/**
 * The pinned stage's geometry, in CSS so the server HTML is already the
 * pinned layout. Read only by the pinned classes.
 *
 *   nav     the sticky navbar (h-14 phones, h-16 from sm) — set by class
 *   step    how much lower each card sits on the pile — set by class
 *   bar     the fixed sticky school bar: its 56px pill over the safe-area pad
 *   band    the visible strip between the two, which the stage centres in
 *   card    a card's height: as tall as the band allows once the pile edges
 *           and the counter fit, between 15rem and the cap (21.5rem phones,
 *           22.5rem from sm) — set by class
 *   deck    the pile: one card plus five edges
 *   meter   the counter row under the pile
 *   stage   the deck plus the meter
 *   top     where the stage sticks: centred in the band, never under the navbar
 *   travel  how far a waiting card sits below its place: from the stage to
 *           past the bottom of the largest viewport, so it rises from off
 *           screen (lvh — the URL bar collapsing must not reveal it)
 *   run     the runway's scroll while pinned (RUN_TOTAL viewports; svh, so
 *           the iOS URL bar never resizes it mid-run)
 */
const PIN = {
  "--why-bar": "calc(3.5rem + max(1rem, env(safe-area-inset-bottom)))",
  "--why-band": "calc(100svh - var(--why-nav) - var(--why-bar))",
  "--why-meter": "2.5rem",
  "--why-card": "clamp(15rem, calc(var(--why-band) - 5 * var(--why-step) - var(--why-meter) - 2rem), var(--why-card-max))",
  "--why-deck": "calc(var(--why-card) + 5 * var(--why-step))",
  "--why-stage": "calc(var(--why-deck) + var(--why-meter))",
  "--why-top": "max(calc(var(--why-nav) + 0.75rem), calc(var(--why-nav) + (var(--why-band) - var(--why-stage)) / 2))",
  "--why-travel": "calc(100lvh - var(--why-top) + 1rem)",
  "--why-run": `${Math.round(RUN_TOTAL * 1000) / 10}svh`,
} as React.CSSProperties

/** How far the card directly beneath a newcomer settles back, and how much each deeper arrival adds. */
const SCALE_NEAR = 0.06
const SCALE_DEEP = 0.018
const DIM_NEAR = 0.32
const DIM_DEEP = 0.07
const DIM_MAX = 0.55

export function WhyBand() {
  const ok = useMotionOK()
  // One arrival value per card (0 → 1 as it slides onto the pile). Each card
  // writes its own; the cards beneath it and the counter read them.
  const [arrivals] = React.useState(() => PILLARS.map(() => motionValue(0)))

  return (
    <section className="relative py-14 sm:py-20 md:py-28" aria-labelledby="why-heading">
      <div className="mx-auto grid max-w-7xl gap-x-16 gap-y-10 px-6 md:gap-y-12 lg:grid-cols-[0.82fr_1.18fr]">
        <div className={ok ? "lg:sticky lg:top-24 lg:self-start" : undefined}>
          <Reveal y={22} duration={0.7}>
            <SectionLabel>Why {BRAND.wordmark}</SectionLabel>
            <SectionTitle id="why-heading" className="mt-4 max-w-md">
              Why learn with {BRAND.name}?
            </SectionTitle>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
              Because the world is changing. The skills that create opportunities
              today are not necessarily the skills that created opportunities
              yesterday. {BRAND.name} is built around the skills shaping tomorrow.
            </p>
          </Reveal>
          {ok && <DeckCounter arrivals={arrivals} className="mt-12 hidden lg:flex" />}
        </div>

        {ok ? <PillarDeck arrivals={arrivals} /> : <PillarGrid />}
      </div>
    </section>
  )
}

/* ── The deck ─────────────────────────────────────────────────────────────── */

function PillarDeck({ arrivals }: { arrivals: MotionValue<number>[] }) {
  const mode = useDeckMode()
  const pinned = mode === "pinned"
  const runwayRef = React.useRef<HTMLDivElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)

  // Pinned only: how far each card still sits below its place on the pile
  // (1 = off screen, 0 = landed), fed to its `--why-y`. Card 01 rides in
  // with the stage, already in place.
  const [lifts] = React.useState(() => PILLARS.map((_, i) => motionValue(i === 0 ? 0 : 1)))

  // Where the stage sticks and how tall it is, in px — measured from the CSS
  // (never read in the scroll path) and turned into the run's scroll offsets.
  // `cover` is how far through its rise a newcomer touches the card beneath.
  const [pin, setPin] = React.useState({ top: 200, stage: 430 })
  const cover = React.useRef(0.5)
  React.useEffect(() => {
    const runway = runwayRef.current
    const stage = stageRef.current
    if (!pinned || !runway || !stage) return
    const measure = () => {
      const css = getComputedStyle(stage)
      const top = parseFloat(css.top) || 0
      const height = stage.offsetHeight
      setPin((p) => (p.top === top && p.stage === height ? p : { top, stage: height }))
      const card = stage.querySelector("li")?.offsetHeight ?? 0
      const step = parseFloat(css.getPropertyValue("--why-step")) || 0
      const travel = window.innerHeight - top + 16
      cover.current = travel > 0 ? clamp01(1 - (card - step) / travel) : 0.5
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(runway)
    ro.observe(stage)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [pinned])

  // 0 as the stage pins, 1 as the runway runs out under it and it lets go.
  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: [`start ${pin.top}px`, `end ${pin.top + pin.stage}px`],
  })

  const deal = React.useCallback(
    (progress: number) => {
      const at = progress * RUN_TOTAL
      lifts[0].set(0)
      arrivals[0].set(1)
      for (let i = 1; i < N; i++) {
        // Rising: fast off the bottom of the screen, easing onto the pile.
        const rise = easeOut(clamp01((at - RUN.lead - (i - 1) * RUN.seg) / (RUN.slide * RUN.seg)))
        lifts[i].set(1 - rise)
        // The card beneath starts settling back while the newcomer is still
        // halfway up to it, so by the time they overlap it is already a step
        // darker and narrower: the seam reads by fill, as cards should (the
        // whole rise is on screen here, unlike the flow deck's).
        const from = cover.current / 2
        arrivals[i].set(clamp01((rise - from) / (1 - from)))
      }
    },
    [arrivals, lifts]
  )
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (pinned) deal(v)
  })
  React.useEffect(() => {
    if (pinned) deal(scrollYProgress.get())
    // The list never settles: nothing lands on anything.
    else if (mode === "list") for (const a of arrivals) a.set(0)
  }, [pinned, mode, deal, scrollYProgress, pin, arrivals])

  return (
    // Pinned: the runway — as tall as the stage plus the run, the stage
    // sticky at its top. Flow and list: plain blocks round the list.
    <div
      ref={runwayRef}
      style={PIN}
      className="relative min-w-0 [--why-card-max:21.5rem] [--why-nav:3.5rem] [--why-step:10px] sm:[--why-card-max:22.5rem] sm:[--why-nav:4rem] sm:[--why-step:14px] max-lg:[@media(min-height:32.51rem)]:h-[calc(var(--why-stage)+var(--why-run))]"
    >
      <div
        ref={stageRef}
        className="max-lg:[@media(min-height:32.51rem)]:sticky max-lg:[@media(min-height:32.51rem)]:top-[var(--why-top)] max-lg:[@media(min-height:32.51rem)]:pb-[var(--why-meter)]"
      >
        {/* Under the pile. First in the DOM so a card rising past it paints over it. */}
        <DeckCounter
          arrivals={arrivals}
          className="absolute bottom-0 left-0 hidden h-5 max-lg:[@media(min-height:32.51rem)]:flex"
        />
        <ul className="relative flex flex-col gap-5 sm:gap-6 max-lg:[@media(min-height:32.51rem)]:block max-lg:[@media(min-height:32.51rem)]:h-[var(--why-deck)]">
          {PILLARS.map((pillar, i) => (
            <DeckCard
              key={pillar.title}
              pillar={pillar}
              index={i}
              arrivals={arrivals}
              lift={lifts[i]}
              flow={mode === "flow"}
            />
          ))}
          {/* lg: the finished pile holds for a beat before the section scrolls
              on — sticky cards stay stuck while their list still has height
              below them. (Pinned, the runway's hold does this.) */}
          <li aria-hidden className="h-16 sm:h-24 max-lg:hidden" />
        </ul>
      </div>
    </div>
  )
}

/**
 * Which card is on top, as "03 / 06" beside a thin rule that fills with the
 * deck — the same run meter the Schools showcase carries, so the page has one
 * grammar for "where you are in this run". lg: under the lede in the sticky
 * column; pinned: under the deck. Scenery — the list itself is what assistive
 * tech reads.
 */
function DeckCounter({ arrivals, className }: { arrivals: MotionValue<number>[]; className?: string }) {
  const onTop = useTransform(arrivals, (values: number[]) => {
    let n = 0
    for (const v of values) if (v > 0.5) n++
    return Math.max(1, n)
  })
  const fill = useTransform(arrivals, (values: number[]) => sum(values, 0) / values.length)
  const [n, setN] = React.useState(1)
  useMotionValueEvent(onTop, "change", (v) => setN(v))

  return (
    <div aria-hidden className={cn("items-center gap-4 text-[13px] font-semibold tabular-nums", className)}>
      <span className="flex items-center gap-1.5">
        <span className="text-ws-primary">{String(n).padStart(2, "0")}</span>
        <span className="text-ws-subtle">/ {TOTAL}</span>
      </span>
      <span className="relative h-px w-40 overflow-hidden bg-ws-hairline">
        <motion.span
          className="absolute inset-0 origin-left bg-ws-primary"
          style={{ scaleX: fill }}
        />
      </span>
    </div>
  )
}

function DeckCard({
  pillar,
  index,
  arrivals,
  lift,
  flow,
}: {
  pillar: (typeof PILLARS)[number]
  index: number
  arrivals: MotionValue<number>[]
  lift: MotionValue<number>
  flow: boolean
}) {
  const ref = React.useRef<HTMLLIElement>(null)
  const stick = FLOW.base + index * FLOW.step
  // Flow: arrival runs from touching the bottom of the card it will cover to
  // its own resting place — the stretch where it is actually sliding over the
  // pile. (Pinned, the deck writes arrivals from the run instead.)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: [`start ${stick - FLOW.step + FLOW.card}px`, `start ${stick}px`],
  })
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (flow) arrivals[index].set(v)
  })
  React.useEffect(() => {
    if (flow) arrivals[index].set(scrollYProgress.get())
  }, [arrivals, index, scrollYProgress, flow])

  // Everything that lands on top of this card pushes it back.
  const above = arrivals.slice(index + 1)
  const scale = useTransform(above, (v: number[]) => 1 - SCALE_NEAR * (v[0] ?? 0) - SCALE_DEEP * sum(v, 1))
  const dim = useTransform(above, (v: number[]) => Math.min(DIM_MAX, DIM_NEAR * (v[0] ?? 0) + DIM_DEEP * sum(v, 1)))
  const vars: MotionStyle & Record<`--${string}`, number | MotionValue<number>> = { "--i": index, "--why-y": lift }

  return (
    <motion.li
      ref={ref}
      // Pinned: every card is laid in its place on the pile and lifted
      // `--why-y` of the travel below it. Flow: sticky in the list. List: static.
      className="lg:sticky lg:top-[calc(96px+var(--i)*14px)] max-lg:[@media(min-height:32.51rem)]:absolute max-lg:[@media(min-height:32.51rem)]:inset-x-0 max-lg:[@media(min-height:32.51rem)]:top-[calc(var(--i)*var(--why-step))] max-lg:[@media(min-height:32.51rem)]:translate-y-[calc(var(--why-y)*var(--why-travel))] max-lg:[@media(min-height:32.51rem)]:will-change-[translate]"
      style={vars}
    >
      <motion.div className="relative origin-top" style={{ scale }}>
        <PillarCard
          pillar={pillar}
          index={index}
          tall
          className="lg:min-h-[17rem] max-lg:[@media(min-height:32.51rem)]:min-h-[var(--why-card)]"
        />
        {/* Settling back: a page-coloured scrim, not card opacity — a
            translucent card would let the pile show through it. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[20px] bg-ws-page"
          style={{ opacity: dim }}
        />
      </motion.div>
    </motion.li>
  )
}

function sum(values: number[], from: number): number {
  let total = 0
  for (let i = from; i < values.length; i++) total += values[i]
  return total
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/* ── Reduced motion: the plain grid ───────────────────────────────────────── */

function PillarGrid() {
  return (
    <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
      {PILLARS.map((pillar, i) => (
        <li key={pillar.title}>
          <PillarCard pillar={pillar} index={i} className="h-full" />
        </li>
      ))}
    </ul>
  )
}

/* ── The card ─────────────────────────────────────────────────────────────── */

function PillarCard({
  pillar,
  index,
  tall = false,
  className,
}: {
  pillar: (typeof PILLARS)[number]
  index: number
  /** The pinned deck's taller card (below lg): the numeral grows to hold the top of it, the words stay anchored at the foot. */
  tall?: boolean
  className?: string
}) {
  const Icon = pillar.icon
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent sm:p-8 lg:p-9",
        className
      )}
    >
      {/* The pillar's glyph again, oversized and barely there — texture for
          the card's empty quarter, in ink, never gold. */}
      <Icon
        aria-hidden
        size={220}
        strokeWidth={0.75}
        className="pointer-events-none absolute -bottom-12 -right-8 hidden text-ws-primary opacity-[0.03] dark:opacity-[0.05] sm:block"
      />
      <div className="relative flex items-start justify-between gap-6">
        <span
          className={cn(
            // Sizes before the leading: tailwind-merge drops a leading that a font size follows.
            tall ? "text-[4.5rem] sm:text-[5rem] lg:text-[4rem]" : "text-[3rem] sm:text-[4rem]",
            "font-display font-light leading-[0.9] tracking-[-0.04em] tabular-nums text-ws-subtle"
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ws-brand/[0.12] text-ws-gold sm:size-12">
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <div className="relative mt-auto pt-8 sm:pt-10">
        <h3 className="font-display text-[22px] font-semibold leading-snug tracking-[-0.015em] text-ws-primary sm:text-[26px]">
          {pillar.title}
        </h3>
        <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-ws-muted sm:text-[16px]">
          {pillar.line}
        </p>
      </div>
    </div>
  )
}
