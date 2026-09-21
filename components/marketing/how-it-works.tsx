"use client"

import * as React from "react"
import Link from "next/link"
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"
import {
  ClassroomVignette,
  PackagesVignette,
  ProgramVignette,
  SchoolsVignette,
} from "@/components/marketing/vignettes"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { Reveal } from "@/components/marketing/motion/reveal"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import { cn } from "@/lib/utils"

/**
 * HOW IT WORKS (spec §11) — the four-step journey beside a vertical track
 * whose gold beam fills with scroll. The beam is the animation (owner call,
 * 2026-09-16): every step's arrival is tied to it.
 *
 * lg+ (the stage): the four steps run down the left beside the track; the
 * product screen is PINNED on the right, centred in the viewport, for the
 * whole run. As the beam's tip — which rides the viewport's middle line —
 * reaches a step, its node lights and rings once, the numeral turns gold,
 * and that step's screen wipes across the pinned frame from the track side,
 * over the one before it (which settles back and dims). The wipe is scrubbed
 * by scroll through a light spring that takes the wheel's steps out of it.
 * One frame, four screens, a step every 42vh: nothing on screen is ever
 * empty, and the section is ~600px shorter (at 1280×800) than the old
 * zig-zag, whose screens sat as blank covered boxes until the beam reached
 * them, with 100px gaps between.
 *
 * Below lg (the list): one column beside the track — each step's label with
 * its screen under it (beside it only from lg, which is reduced motion: a
 * tablet's half-width screen squeezed the vignettes' sm/md layouts), the
 * screen wiped open from the track as it rises into view, and fully open by
 * the time it reaches the lower third — a phone never shows a half-covered
 * screen under the step it illustrates.
 *
 * Screens mount the moment their wipe starts, so their own arrival — school
 * tiles staggering, curriculum rows landing, tiers dropping in, the lesson
 * list and progress bars filling — plays while they are uncovered. They stay
 * mounted after that; scrolling back only re-covers them, nothing replays.
 *
 * Reduced motion: the list layout at every width, track fully lit, no
 * covers, no pinning — labels and screens simply stand.
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

/** A light spring over the raw scroll progress — smooths wheel steps without lagging. */
const WIPE_SPRING = { stiffness: 170, damping: 28, mass: 0.5 }

/** A step's wipe past this point mounts its screen (latched). */
const MOUNT_AT = 0.02

export function HowItWorks() {
  const ok = useMotionOK()
  const wide = useMediaQuery("(min-width: 1024px)")

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 pb-12 pt-14 sm:pb-16 sm:pt-20 md:pb-20 md:pt-28"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-7xl px-6">
        {ok && wide ? <StageRun /> : <ListRun ok={ok} />}

        {/* Spec §11 close: "Your journey starts here." + [EXPLORE PROGRAMS] */}
        <Reveal
          y={18}
          duration={0.6}
          className="mt-14 flex flex-col items-start gap-5 border-t border-ws-hairline pt-10 sm:flex-row sm:items-center sm:justify-between md:mt-16"
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

function Heading() {
  return (
    <Reveal y={22} duration={0.7}>
      <SectionLabel>How it works</SectionLabel>
      <SectionTitle id="how-heading" className="mt-4 max-w-2xl">
        Start your journey
        <br />
        in four simple steps.
      </SectionTitle>
    </Reveal>
  )
}

/* ── Shared pieces ────────────────────────────────────────────────────────── */

/** The track and its beam. `progress` 0 → 1 fills it; reduced motion shows it lit. */
function Track({ progress, ok }: { progress: MotionValue<number>; ok: boolean }) {
  return (
    <div aria-hidden className="absolute bottom-0 left-[7px] top-1 w-px bg-ws-hairline">
      {ok ? (
        <motion.div
          className="h-full w-px origin-top bg-gradient-to-b from-ws-gold via-ws-gold to-transparent"
          style={{ scaleY: progress }}
        />
      ) : (
        <div className="h-full w-px bg-ws-gold/60" />
      )}
    </div>
  )
}

/** The node on the track — lights when the beam reaches it, and rings once. */
function Node({ lit, ok }: { lit: boolean; ok: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute left-0 top-1 flex size-4 items-center justify-center rounded-full border border-ws-hairline bg-ws-surface"
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
  )
}

function StepCopy({ step, lit, large }: { step: Step; lit: boolean; large?: boolean }) {
  return (
    <>
      <span
        className={cn(
          "block font-display font-light leading-none tracking-[-0.03em] tabular-nums transition-colors duration-[var(--ws-motion-slow)]",
          large ? "text-[3.25rem]" : "text-[2.75rem] md:text-[3.25rem]",
          lit ? "text-ws-gold" : "text-ws-subtle"
        )}
      >
        {step.step}
      </span>
      <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary md:text-[1.75rem]">
        {step.label}
      </h3>
      <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-ws-muted">{step.body}</p>
    </>
  )
}

/** Latches true once `progress` passes `at` — or immediately under reduced motion. */
function useLatch(progress: MotionValue<number>, at: number, ok: boolean) {
  const [on, setOn] = React.useState(false)
  useMotionValueEvent(progress, "change", (v) => {
    if (v > at) setOn(true)
  })
  React.useEffect(() => {
    // A page opened mid-way down has steps already past the line.
    if (!ok || progress.get() > at) setOn(true)
  }, [ok, progress, at])
  return on
}

/** Live (not latched): true while `progress` is past `at` — the beam can retract. */
function useLive(progress: MotionValue<number>, at: number, ok: boolean) {
  const [on, setOn] = React.useState(false)
  useMotionValueEvent(progress, "change", (v) => setOn(!ok || v >= at))
  React.useEffect(() => {
    setOn(!ok || progress.get() >= at)
  }, [ok, progress, at])
  return on
}

/* ── lg+: the stage — steps beside a pinned screen ────────────────────────── */

/**
 * Geometry: the beam's tip rides the viewport's middle line (`LINE`), and so
 * do the nodes' "lit" moments; each screen's wipe runs while its node climbs
 * from `WIPE_FROM` to that line (20vh of scroll). Steps are 42vh apart, so
 * each screen rests, whole, for ~22vh before the next one starts across it,
 * and the last block is tall enough that the final screen holds, pinned, for
 * a beat after its step lights.
 */
const LINE = 0.5
const WIPE_FROM = 0.7
/** The first screen opens as the frame itself rises into view, so it never waits blank. */
const FIRST_WIPE_FROM = 1.3

function StageRun() {
  const listRef = React.useRef<HTMLOListElement>(null)
  const [stepRefs] = React.useState(() => STEPS.map(() => React.createRef<HTMLLIElement>()))
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: [`start ${LINE}`, `end ${LINE}`],
  })

  return (
    <div className="grid grid-cols-[0.8fr_1.2fr] gap-16 xl:gap-24">
      <div className="min-w-0">
        <Heading />
        <div className="relative mt-16">
          <Track progress={scrollYProgress} ok />
          <ol ref={listRef}>
            {STEPS.map((step, i) => (
              <StageStep
                key={step.id}
                ref={stepRefs[i]}
                step={step}
                last={i === STEPS.length - 1}
              />
            ))}
          </ol>
        </div>
      </div>

      {/* The pinned frame. Centred in the viewport, never above the navbar. */}
      <div aria-hidden className="relative min-w-0">
        <div className="sticky top-[max(6.5rem,calc(50vh-13.5rem))] h-[27rem] overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface">
          {STEPS.map((step, i) => (
            <StageScreen key={step.id} step={step} index={i} target={stepRefs[i]} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StageStep({
  ref,
  step,
  last,
}: {
  ref: React.RefObject<HTMLLIElement | null>
  step: Step
  last: boolean
}) {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", `start ${LINE}`] })
  const lit = useLive(scrollYProgress, 0.995, true)
  // Steps ahead of the beam wait at a quiet 35%, then come up to full as the
  // beam approaches — the column is always readable, never blank.
  const opacity = useTransform(scrollYProgress, [0.55, 1], [0.35, 1])
  const x = useTransform(scrollYProgress, [0.55, 1], [14, 0])

  return (
    <li
      ref={ref}
      className={cn("relative pl-12", last ? "min-h-[calc(50vh+4rem)]" : "min-h-[42vh]")}
    >
      <Node lit={lit} ok />
      <motion.div style={{ opacity, x }}>
        <StepCopy step={step} lit={lit} large />
      </motion.div>
    </li>
  )
}

function StageScreen({
  step,
  index,
  target,
}: {
  step: Step
  index: number
  target: React.RefObject<HTMLLIElement | null>
}) {
  const { scrollYProgress } = useScroll({
    target,
    offset: [`start ${index === 0 ? FIRST_WIPE_FROM : WIPE_FROM}`, `start ${LINE}`],
  })
  const t = useSpring(scrollYProgress, WIPE_SPRING)
  const mounted = useLatch(scrollYProgress, MOUNT_AT, true)
  // Wiped across from the track side: the clip's right edge retreats.
  const clipPath = useTransform(t, (v) => `inset(0 ${((1 - v) * 100).toFixed(2)}% 0 0)`)
  // The screen rides in with the wipe, a touch behind it.
  const x = useTransform(t, [0, 1], [-36, 0])
  const scrim = useTransform(t, [0, 1], [0, 0.5])

  return (
    <>
      {/* Between this screen and the one beneath it: the old screen settles
          back and dims as this one crosses it. */}
      {index > 0 && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-ws-page"
          style={{ opacity: scrim, zIndex: index * 2 }}
        />
      )}
      <motion.div
        className="absolute inset-0 overflow-hidden bg-ws-surface"
        style={{ clipPath, zIndex: index * 2 + 1 }}
      >
        <motion.div className="absolute inset-0" style={{ x }}>
          {mounted && <step.Vignette />}
        </motion.div>
      </motion.div>
    </>
  )
}

/* ── Below lg, and reduced motion everywhere: the list ────────────────────── */

function ListRun({ ok }: { ok: boolean }) {
  const listRef = React.useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 0.6", "end 0.6"] })

  return (
    <>
      <Heading />
      <div className="relative mt-12 md:mt-16">
        <Track progress={scrollYProgress} ok={ok} />
        <ol ref={listRef} className="space-y-12 md:space-y-14">
          {STEPS.map((step) => (
            <ListStep key={step.id} step={step} ok={ok} />
          ))}
        </ol>
      </div>
    </>
  )
}

function ListStep({ step, ok }: { step: Step; ok: boolean }) {
  const ref = React.useRef<HTMLLIElement>(null)
  const screenRef = React.useRef<HTMLDivElement>(null)
  const beam = useScroll({ target: ref, offset: ["start end", "start 0.6"] })
  const lit = useLive(beam.scrollYProgress, 0.995, ok)
  // The wipe keys on the screen itself: it opens as the screen rises into
  // the lower part of the viewport, so it never waits there blank.
  const { scrollYProgress } = useScroll({ target: screenRef, offset: ["start 0.98", "start 0.7"] })
  const t = useSpring(scrollYProgress, WIPE_SPRING)
  const cover = useTransform(t, [0, 1], [1, 0])
  const mounted = useLatch(scrollYProgress, MOUNT_AT, ok)

  return (
    <li ref={ref} className="relative grid gap-6 pl-10 md:pl-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-10">
      <Node lit={lit} ok={ok} />
      <div className="min-w-0">
        <div className="lg:sticky lg:top-28">
          <StepCopy step={step} lit={lit} />
        </div>
      </div>
      <div
        ref={screenRef}
        aria-hidden
        className="relative h-[24rem] min-w-0 overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface md:h-[26rem]"
      >
        <div className="absolute inset-0">{mounted && <step.Vignette />}</div>
        {ok && (
          <motion.div
            className="absolute inset-0 origin-right bg-ws-page will-change-transform"
            style={{ scaleX: cover }}
          />
        )}
      </div>
    </li>
  )
}
