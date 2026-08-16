"use client"

import * as React from "react"
import { motion, useScroll, useTransform } from "motion/react"
import {
  BrowserFrame,
  ClassroomVignette,
  LiveRoomVignette,
  ExamVignette,
} from "@/components/marketing/hero-slider"
import { Reveal } from "@/components/marketing/motion/reveal"
import { useMotionOK } from "@/components/marketing/motion/bus"

/**
 * §— INSIDE THE ACADEMY, as a timeline. The three rooms run down the page in
 * order — classroom → live room → exam & certificate — beside a vertical
 * track whose gold beam fills with scroll, so the section reads as the path
 * a student actually walks. Left column: sticky step label; right: the room
 * itself in a browser frame.
 *
 * The beam is scroll-linked (useScroll on the section, spring-free transform;
 * height and glow both derive from progress). Reduced motion: the track
 * renders fully lit, entries plain-fade.
 */
const STEPS = [
  {
    id: "learn",
    step: "01",
    label: "The classroom",
    route: "/dashboard/courses/…/learn",
    body: "Video and text lessons in order, free previews, and a watch position that autosaves.",
    Vignette: ClassroomVignette,
  },
  {
    id: "live",
    step: "02",
    label: "The live room",
    route: "/dashboard/meetings",
    body: "Scheduled live classes with class chat — raise a hand, ask mid-lesson.",
    Vignette: LiveRoomVignette,
  },
  {
    id: "exam",
    step: "03",
    label: "Exam → certificate",
    route: "/dashboard/courses/…/exam",
    body: "A timed exam with a pass mark, then a signed certificate with its own ID.",
    Vignette: ExamVignette,
  },
] as const

export function RoomsTimeline() {
  const ok = useMotionOK()
  const trackRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 0.7", "end 0.6"],
  })
  const beamHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  return (
    <section className="relative py-24 md:py-32" aria-label="Inside the academy">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal y={22} duration={0.7}>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            Inside the academy
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ws-primary">
            First lesson to signed certificate,
            <br />
            one room at a time.
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

          <div className="space-y-20 md:space-y-32">
            {STEPS.map((step, i) => {
              const flip = i % 2 === 1
              return (
                <div
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

                  {/* Label — sticky while its room scrolls by on desktop. */}
                  <div
                    className={
                      flip
                        ? "md:order-2 md:pl-16"
                        : "md:pr-16 md:text-right"
                    }
                  >
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

                  {/* The room */}
                  <div className={flip ? "md:order-1 md:pr-16" : "md:pl-16"}>
                    <Reveal y={28} duration={0.75}>
                      <div className="h-[24rem] md:h-[28rem]">
                        <BrowserFrame route={step.route}>
                          <step.Vignette />
                        </BrowserFrame>
                      </div>
                    </Reveal>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
