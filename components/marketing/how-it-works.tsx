"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useScroll, useTransform } from "motion/react"
import {
  BrowserFrame,
  ClassroomVignette,
  PackagesVignette,
  ProgramVignette,
  SchoolsVignette,
} from "@/components/marketing/vignettes"
import { Reveal } from "@/components/marketing/motion/reveal"
import { useMotionOK } from "@/components/marketing/motion/bus"

/**
 * HOW IT WORKS (spec §11) — the four-step journey as a timeline: sticky step
 * label on one side, the product moment in a browser frame on the other,
 * beside a vertical track whose gold beam fills with scroll. One section now
 * tells the story the old Programs index + Rooms timeline pair told twice.
 *
 * The beam is scroll-linked (useScroll on the track, spring-free transform).
 * Reduced motion: the track renders fully lit, entries plain-fade.
 */
const STEPS = [
  {
    id: "school",
    step: "01",
    label: "Choose your school",
    route: "/schools",
    body: "Find the area that matches your goals.",
    Vignette: SchoolsVignette,
  },
  {
    id: "program",
    step: "02",
    label: "Select your program",
    route: "/programs/forex-trading-mastery",
    body: "Explore the curriculum, instructors, benefits and learning format.",
    Vignette: ProgramVignette,
  },
  {
    id: "package",
    step: "03",
    label: "Choose your package",
    route: "/programs/forex-trading-mastery#packages",
    body: "Select the learning experience that fits your needs.",
    Vignette: PackagesVignette,
  },
  {
    id: "enrol",
    step: "04",
    label: "Enrol & start learning",
    route: "/dashboard/courses/…/learn",
    body: "Complete your payment and gain access to your learning dashboard.",
    Vignette: ClassroomVignette,
  },
] as const

export function HowItWorks() {
  const ok = useMotionOK()
  const trackRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 0.7", "end 0.6"],
  })
  const beamHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  return (
    <section id="how-it-works" className="relative scroll-mt-24 py-24 md:py-32" aria-label="How it works">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal y={22} duration={0.7}>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            How it works
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ws-primary">
            Start your journey
            <br />
            in four simple steps.
          </h2>
        </Reveal>

        <div ref={trackRef} className="relative mt-16 md:mt-20">
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

          <ol className="space-y-20 md:space-y-32">
            {STEPS.map((step, i) => {
              const flip = i % 2 === 1
              return (
                <li
                  key={step.id}
                  className="relative grid gap-8 pl-10 md:grid-cols-2 md:gap-16 md:pl-0"
                >
                  {/* Node on the track */}
                  <span
                    aria-hidden
                    className="absolute left-0 top-1 flex size-4 items-center justify-center rounded-full border border-ws-hairline bg-ws-surface md:left-1/2 md:-translate-x-1/2"
                  >
                    <span className="size-1.5 rounded-full bg-ws-gold" />
                  </span>

                  {/* Label — sticky while its frame scrolls by on desktop. */}
                  <div className={flip ? "min-w-0 md:order-2 md:pl-16" : "min-w-0 md:pr-16 md:text-right"}>
                    <div className="md:sticky md:top-28">
                      <Reveal y={18} duration={0.6}>
                        <span className="font-display text-[13px] font-bold tracking-[0.14em] text-ws-gold">
                          {step.step}
                        </span>
                        <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary md:text-3xl">
                          {step.label}
                        </h3>
                        <p
                          className={
                            "mt-3 max-w-sm text-[14px] leading-relaxed text-ws-muted" +
                            (flip ? "" : " md:ml-auto")
                          }
                        >
                          {step.body}
                        </p>
                      </Reveal>
                    </div>
                  </div>

                  {/* The product moment */}
                  <div className={flip ? "min-w-0 md:order-1 md:pr-16" : "min-w-0 md:pl-16"}>
                    <Reveal y={28} duration={0.75}>
                      <div className="h-[24rem] md:h-[28rem]">
                        <BrowserFrame route={step.route}>
                          <step.Vignette />
                        </BrowserFrame>
                      </div>
                    </Reveal>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Spec §11 close: "Your journey starts here." + [EXPLORE PROGRAMS] */}
        <Reveal
          y={18}
          duration={0.6}
          className="mt-20 flex flex-col items-start gap-5 border-t border-ws-hairline pt-10 sm:flex-row sm:items-center sm:justify-between md:mt-24"
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
