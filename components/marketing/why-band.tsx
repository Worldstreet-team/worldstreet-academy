"use client"

import * as React from "react"
import {
  motion,
  motionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react"
import {
  CompassIcon,
  GaugeIcon,
  GraduationCapIcon,
  HammerIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { Reveal } from "@/components/marketing/motion/reveal"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

/**
 * WHY (spec §3) — the six pillars as a deck. Each card is `position: sticky`
 * a little lower than the one before it, so as the page scrolls the cards
 * slide up and pile onto each other, each leaving a 10–14px edge showing. As
 * a card arrives the cards beneath it settle back: the one directly under it
 * scales to 0.94 and dims, the deeper ones a little further, so the pile reads
 * as depth rather than a stack of equal slabs. Everything is a function of
 * scroll position — scroll back up and the deck deals itself out again.
 *
 * At lg the heading and the "Because the world is changing" lede sit in a
 * sticky left column beside the deck, with a quiet counter for the card on
 * top. Phones stack with tighter offsets under the 56px navbar.
 *
 * Cards are v2 cards (04-components → Card): `surface` fill, 20px corners,
 * separated by fill in dark and a hairline in light. The gold is confined to
 * the icon chip's wash. Copy is §3 verbatim.
 *
 * Reduced motion: no sticking, no scrub — the six cards stand in a plain grid.
 */
const PILLARS: readonly { icon: LucideIcon; title: string; line: string }[] = [
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

const TOTAL = String(PILLARS.length).padStart(2, "0")

/**
 * Deck geometry, in px. `base` = where the first card sticks (navbar + air),
 * `step` = how much lower each next card sticks, `card` = the cards' min
 * height (the class list below must agree). Phones sit under the 56px bar,
 * sm+ under the 64px one.
 */
const DECK = {
  phone: { base: 56 + 16, step: 10, card: 240 },
  wide: { base: 64 + 32, step: 14, card: 272 },
} as const

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
          {ok && <DeckCounter arrivals={arrivals} />}
        </div>

        {ok ? <PillarDeck arrivals={arrivals} /> : <PillarGrid />}
      </div>
    </section>
  )
}

/* ── The deck ─────────────────────────────────────────────────────────────── */

function PillarDeck({ arrivals }: { arrivals: MotionValue<number>[] }) {
  const wide = useMediaQuery("(min-width: 640px)")
  const geometry = wide ? DECK.wide : DECK.phone

  return (
    <ul className="relative flex min-w-0 flex-col gap-5 sm:gap-6">
      {PILLARS.map((pillar, i) => (
        <DeckCard
          key={pillar.title}
          pillar={pillar}
          index={i}
          arrivals={arrivals}
          geometry={geometry}
        />
      ))}
      {/* The finished pile holds for a beat before the section scrolls on:
          sticky cards stay stuck while their list still has height below them. */}
      <li aria-hidden className="h-16 sm:h-24" />
    </ul>
  )
}

/**
 * lg only, under the lede in the sticky column: which card is on top, as
 * "03 / 06" beside a thin rule that fills with the deck — the same run meter
 * the Schools showcase carries, so the page has one grammar for "where you
 * are in this run". Scenery — the list itself is what assistive tech reads.
 */
function DeckCounter({ arrivals }: { arrivals: MotionValue<number>[] }) {
  const onTop = useTransform(arrivals, (values: number[]) => {
    let n = 0
    for (const v of values) if (v > 0.5) n++
    return Math.max(1, n)
  })
  const fill = useTransform(arrivals, (values: number[]) => sum(values, 0) / values.length)
  const [n, setN] = React.useState(1)
  useMotionValueEvent(onTop, "change", (v) => setN(v))

  return (
    <div aria-hidden className="mt-12 hidden items-center gap-4 text-[13px] font-semibold tabular-nums lg:flex">
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
  geometry,
}: {
  pillar: (typeof PILLARS)[number]
  index: number
  arrivals: MotionValue<number>[]
  geometry: (typeof DECK)[keyof typeof DECK]
}) {
  const ref = React.useRef<HTMLLIElement>(null)
  const stick = geometry.base + index * geometry.step
  // Arrival runs from touching the bottom of the card it will cover to its own
  // resting place — the stretch where it is actually sliding over the pile.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: [`start ${stick - geometry.step + geometry.card}px`, `start ${stick}px`],
  })
  useMotionValueEvent(scrollYProgress, "change", (v) => arrivals[index].set(v))
  React.useEffect(() => {
    arrivals[index].set(scrollYProgress.get())
  }, [arrivals, index, scrollYProgress])

  // Everything that lands on top of this card pushes it back.
  const above = arrivals.slice(index + 1)
  const scale = useTransform(above, (v: number[]) => 1 - SCALE_NEAR * (v[0] ?? 0) - SCALE_DEEP * sum(v, 1))
  const dim = useTransform(above, (v: number[]) => Math.min(DIM_MAX, DIM_NEAR * (v[0] ?? 0) + DIM_DEEP * sum(v, 1)))

  return (
    <li
      ref={ref}
      className="sticky top-[calc(72px+var(--i)*10px)] sm:top-[calc(96px+var(--i)*14px)]"
      style={{ "--i": index } as React.CSSProperties}
    >
      <motion.div className="relative origin-top" style={{ scale }}>
        <PillarCard pillar={pillar} index={index} className="min-h-[15rem] sm:min-h-[17rem]" />
        {/* Settling back: a page-coloured scrim, not card opacity — a
            translucent card would let the pile show through it. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[20px] bg-ws-page"
          style={{ opacity: dim }}
        />
      </motion.div>
    </li>
  )
}

function sum(values: number[], from: number): number {
  let total = 0
  for (let i = from; i < values.length; i++) total += values[i]
  return total
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
  className,
}: {
  pillar: (typeof PILLARS)[number]
  index: number
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
        <span className="font-display text-[3rem] font-light leading-[0.9] tracking-[-0.04em] tabular-nums text-ws-subtle sm:text-[4rem]">
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
