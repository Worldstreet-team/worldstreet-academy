"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { motion, useScroll, useTransform, type MotionValue } from "motion/react"
import { cn } from "@/lib/utils"
import { Reveal } from "@/components/marketing/motion/reveal"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { SectionLabel } from "@/components/marketing/section-heading"
import { BRAND } from "@/lib/brand"

/** The blueprint's own arc (§2, last line). A real sequence, so the one
 *  stepped device on the page is earned here; the last stop is the outcome,
 *  and the only word on the rule that takes gold. */
const ARC = ["Interest", "Knowledge", "Skill", "Opportunity"] as const

/** The purpose statement (§2, verbatim). */
const STATEMENT =
  "To help people learn valuable skills, develop practical capabilities and create opportunities for themselves in the new economy."

/** Unlit words sit at this opacity of the ink — present, legible as shapes, clearly waiting. */
const DIM = 0.18

/** Each word brightens over this share of the run, so ~three words are mid-change at once. */
const WORD_SPAN = 0.14

/**
 * ABOUT (spec §2) — typographic. The purpose statement is set as one wide
 * paragraph in the house hero register: Poppins Light 300, large, the weight
 * the wallet hero gives its balance, borrowed here for words. Under it the
 * interest → opportunity arc, then the remaining spec paragraphs in two body
 * columns. "Welcome to…" is the small title beside the label — the statement
 * is the picture, and nothing here duplicates the Why band's heading any more.
 * Copy is §2 verbatim; only the typesetting changed.
 *
 * Moment 3: the statement lights up word by word, scrubbed by scroll — it
 * arrives dim and each word turns to full ink in reading order as the
 * paragraph travels from 85% to 45% of the viewport. Scroll back and it dims
 * again. The words are plain spans inside the one paragraph, so it is read
 * (and copied) as a single sentence. Reduced motion: fully lit, still.
 */
export function AboutBand() {
  return (
    // lg:pt-20 — the Schools stage above already ends in its own reserve for the sticky school bar.
    <section className="relative py-14 sm:py-20 md:py-28 lg:pt-20" aria-labelledby="about-heading">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[13rem_1fr]">
          {/* Label column */}
          <Reveal>
            <SectionLabel>About</SectionLabel>
            <h2
              id="about-heading"
              className="mt-3 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary"
            >
              Welcome to {BRAND.name}.
            </h2>
          </Reveal>

          <div className="min-w-0">
            {/* The statement */}
            <Reveal as="p" className="text-[15px] text-ws-muted">
              Our purpose is simple:
            </Reveal>
            <LitStatement text={STATEMENT} />

            {/* The arc — ordered, because it is one. */}
            <Reveal delay={0.12}>
              {/* One line with hairline connectors from sm; on a phone the four
                  stops sit two by two (the line broke after "Skill" there,
                  orphaning a connector and "Opportunity"). */}
              <ol
                aria-label="From interest to opportunity"
                className="mt-10 grid grid-cols-2 gap-y-3 sm:flex sm:flex-wrap sm:items-center md:mt-12"
              >
                {ARC.map((stop, i) => {
                  const last = i === ARC.length - 1
                  return (
                    <li key={stop} className="flex items-center">
                      {i > 0 && (
                        <span
                          aria-hidden
                          className="mx-4 hidden h-px w-12 bg-ws-hairline sm:block md:w-20 lg:w-28"
                        />
                      )}
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className={cn("size-1.5 rounded-full", last ? "bg-ws-brand" : "bg-ws-subtle")}
                        />
                        <span
                          className={cn(
                            "font-display text-[15px] font-semibold tracking-[-0.01em] md:text-[16px]",
                            last ? "text-ws-gold" : "text-ws-primary"
                          )}
                        >
                          {stop}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            </Reveal>

            {/* The argument — two body columns under one hairline. */}
            <div className="mt-12 grid gap-x-12 gap-y-6 border-t border-ws-hairline pt-10 md:mt-14 md:grid-cols-2">
              <Reveal delay={0.05} className="space-y-4 text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
                <p>
                  {BRAND.name} is the education and skills development arm of
                  the WorldStreet ecosystem.
                </p>
                <p>
                  We bring together expert instructors, structured programs,
                  practical learning experiences, mentorship and a growing
                  ecosystem of opportunities.
                </p>
              </Reveal>
              <Reveal delay={0.1} className="text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
                <p>
                  From financial markets to artificial intelligence, from
                  blockchain to cybersecurity, from content creation to digital
                  business, {BRAND.name} is designed to help you move from
                  interest to knowledge, knowledge to skill, and skill to
                  opportunity.
                </p>
                <Link
                  href="/schools"
                  className="group mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                >
                  <span className="relative">
                    Explore the schools
                    <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-ws-primary transition-transform duration-200 ease-[var(--ws-ease)] group-hover:scale-x-100" />
                  </span>
                  <ArrowRightIcon
                    size={14}
                    aria-hidden
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </Link>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The statement, lit word by word as it scrolls from 85% to 45% of the viewport. */
function LitStatement({ text }: { text: string }) {
  const ok = useMotionOK()
  const ref = React.useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] })
  const words = text.split(" ")
  const last = words.length - 1

  return (
    <p
      ref={ref}
      className="mt-4 max-w-4xl font-display text-[clamp(1.75rem,3.6vw,3.25rem)] font-light leading-[1.18] tracking-[-0.02em] text-ws-primary"
    >
      {words.map((word, i) => {
        // Word i's slice of the run; the slices overlap so the light travels, not steps.
        const from = (i / last) * (1 - WORD_SPAN)
        return (
          <React.Fragment key={i}>
            <Word progress={scrollYProgress} range={[from, from + WORD_SPAN]} still={!ok}>
              {word}
            </Word>
            {i < last && " "}
          </React.Fragment>
        )
      })}
    </p>
  )
}

function Word({
  progress,
  range,
  still,
  children,
}: {
  progress: MotionValue<number>
  range: [number, number]
  still: boolean
  children: string
}) {
  const opacity = useTransform(progress, range, [DIM, 1])
  // The class lights every word for reduced motion from the first paint,
  // before the post-hydration pass drops the scrub.
  return (
    <motion.span style={still ? undefined : { opacity }} className="motion-reduce:opacity-100!">
      {children}
    </motion.span>
  )
}
