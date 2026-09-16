"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react"
import {
  ClassroomVignette,
  PackagesVignette,
  ProgramVignette,
  SchoolsVignette,
} from "@/components/marketing/vignettes"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { Reveal } from "@/components/marketing/motion/reveal"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import { cn } from "@/lib/utils"

/**
 * HOW IT WORKS (spec §11) — the four-step journey as a timeline: sticky step
 * label on one side, the product moment on the other, beside a vertical track
 * whose gold beam fills with scroll.
 *
 * The beam is the animation, so every step's arrival is tied to it (owner
 * call, 2026-09-16 — the old fade-up-on-scroll read as a stock reveal). As
 * the beam reaches a node: the node lights gold and rings once, the numeral
 * turns gold and the label drifts in from the track, and the screen is
 * WIPED open from the track outward — a page-coloured cover retreats with
 * the scroll (a light spring takes the wheel's steps out of it), and only
 * then does the screen mount, so its own arrival — school tiles staggering,
 * curriculum rows landing, tiers dropping in, the lesson list and progress
 * bars filling — plays while it is being uncovered instead of silently on
 * page load. Scroll back up and the covers close again; the screens stay
 * mounted, so nothing replays.
 *
 * The screens are plain 20px panels now — no browser chrome, no address
 * bar: the moment is the product, not a mock of a window around it.
 * Reduced motion: the track renders fully lit, covers are gone, labels and
 * screens simply stand.
 */
const STEPS = [
  {
    id: "school",
    step: "01",
    label: "Choose your school",
    body: "Find the area that matches your goals.",
    Vignette: SchoolsVignette,
  },
  {
    id: "program",
    step: "02",
    label: "Select your program",
    body: "Explore the curriculum, instructors, benefits and learning format.",
    Vignette: ProgramVignette,
  },
  {
    id: "package",
    step: "03",
    label: "Choose your package",
    body: "Select the learning experience that fits your needs.",
    Vignette: PackagesVignette,
  },
  {
    id: "enrol",
    step: "04",
    label: "Enrol & start learning",
    body: "Complete your payment and gain access to your learning dashboard.",
    Vignette: ClassroomVignette,
  },
] as const

type Step = (typeof STEPS)[number]

export function HowItWorks() {
  const ok = useMotionOK()
  const trackRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 0.7", "end 0.6"],
  })
  const beamHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 py-14 sm:py-20 md:py-28"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-7xl px-6">
        <Reveal y={22} duration={0.7}>
          <SectionLabel>How it works</SectionLabel>
          <SectionTitle id="how-heading" className="mt-4 max-w-2xl">
            Start your journey
            <br />
            in four simple steps.
          </SectionTitle>
        </Reveal>

        <div ref={trackRef} className="relative mt-14 md:mt-20">
          {/* Track + beam */}
          <div
            aria-hidden
            className="absolute bottom-0 left-[7px] top-0 w-px bg-ws-hairline md:left-1/2"
          >
            {ok ? (
              <motion.div
                className="w-px origin-top bg-gradient-to-b from-ws-gold via-ws-gold to-transparent"
                style={{ height: beamHeight }}
              />
            ) : (
              <div className="h-full w-px bg-ws-gold/60" />
            )}
          </div>

          <ol className="space-y-16 md:space-y-24">
            {STEPS.map((step, i) => (
              <StepEntry key={step.id} step={step} index={i} ok={ok} />
            ))}
          </ol>
        </div>

        {/* Spec §11 close: "Your journey starts here." + [EXPLORE PROGRAMS] */}
        <Reveal
          y={18}
          duration={0.6}
          className="mt-16 flex flex-col items-start gap-5 border-t border-ws-hairline pt-10 sm:flex-row sm:items-center sm:justify-between md:mt-20"
        >
          <p className="font-display text-xl font-semibold tracking-[-0.01em] text-ws-primary md:text-2xl">
            Your journey starts here.
          </p>
          <Link
            href="/schools"
            className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-8 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
          >
            Explore programs
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * The band of the viewport a node crosses while the beam reaches it: the
 * step is untouched with its node at 78% of the viewport height and fully
 * lit at 42% — the same span the beam is tuned to (start 0.7 → end 0.6 over
 * the whole track), so the wipe and the beam arrive together.
 */
const REVEAL_OFFSET = ["start 0.78", "start 0.42"] as const

/** Past this point the step counts as reached: node and numeral go gold, the screen mounts. */
const LIT_AT = 0.3

function StepEntry({ step, index, ok }: { step: Step; index: number; ok: boolean }) {
  const flip = index % 2 === 1
  const ref = React.useRef<HTMLLIElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: [...REVEAL_OFFSET] })
  // A light spring takes the wheel's steps out of the wipe without lagging the scroll.
  const t = useSpring(scrollYProgress, { stiffness: 170, damping: 28, mass: 0.5 })
  const cover = useTransform(t, [0, 1], [1, 0])
  const labelX = useTransform(t, [0, 1], [flip ? -24 : 24, 0])
  const labelOpacity = useTransform(t, [0, 0.55], [0, 1])

  // Latched: once reached, a step stays reached. Scrolling back up closes
  // the cover again but never unmounts the screen, so nothing replays.
  const [lit, setLit] = React.useState(false)
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v > LIT_AT) setLit(true)
  })
  React.useEffect(() => {
    // Reduced motion shows everything at once; a page opened mid-way down
    // has steps already past the beam.
    if (!ok || scrollYProgress.get() > LIT_AT) setLit(true)
  }, [ok, scrollYProgress])

  return (
    <li ref={ref} className="relative grid gap-8 pl-10 md:grid-cols-2 md:gap-16 md:pl-0">
      {/* Node on the track — lights when the beam reaches it, and rings once. */}
      <span
        aria-hidden
        className="absolute left-0 top-1 flex size-4 items-center justify-center rounded-full border border-ws-hairline bg-ws-surface md:left-1/2 md:-translate-x-1/2"
      >
        <span
          className={cn(
            "size-1.5 rounded-full transition-colors duration-[var(--ws-motion-base)]",
            lit ? "bg-ws-gold" : "bg-ws-subtle/60"
          )}
        />
        {lit && ok && (
          <motion.span
            className="absolute inset-0 rounded-full border border-ws-gold"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2.8, opacity: 0 }}
            transition={{ duration: 0.9, ease: EASE_INERTIA }}
          />
        )}
      </span>

      {/* Label — sticky while its screen scrolls by on desktop; drifts in from the track. */}
      <div className={flip ? "min-w-0 md:order-2 md:pl-16" : "min-w-0 md:pr-16 md:text-right"}>
        <div className="md:sticky md:top-28">
          <motion.div style={ok ? { x: labelX, opacity: labelOpacity } : undefined}>
            <span
              className={cn(
                "block font-display text-[2.75rem] font-light leading-none tracking-[-0.03em] tabular-nums transition-colors duration-[var(--ws-motion-slow)] md:text-[3.5rem]",
                lit ? "text-ws-gold" : "text-ws-subtle"
              )}
            >
              {step.step}
            </span>
            <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary md:text-3xl">
              {step.label}
            </h3>
            <p
              className={cn(
                "mt-3 max-w-sm text-[15px] leading-relaxed text-ws-muted",
                !flip && "md:ml-auto"
              )}
            >
              {step.body}
            </p>
          </motion.div>
        </div>
      </div>

      {/* The screen — a plain panel, wiped open from the track outward. */}
      <div className={flip ? "min-w-0 md:order-1 md:pr-16" : "min-w-0 md:pl-16"}>
        <div
          aria-hidden
          className="relative h-[24rem] overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface md:h-[27rem]"
        >
          <div className="absolute inset-0">{lit && <step.Vignette />}</div>
          {ok && (
            <motion.div
              // Below md every screen sits right of the rail, so the cover
              // always retreats rightward there; from md a left-side screen
              // retreats leftward, away from the track in the middle.
              className={cn(
                "absolute inset-0 bg-ws-page will-change-transform",
                flip ? "origin-right md:origin-left" : "origin-right"
              )}
              style={{ scaleX: cover }}
            />
          )}
        </div>
      </div>
    </li>
  )
}
