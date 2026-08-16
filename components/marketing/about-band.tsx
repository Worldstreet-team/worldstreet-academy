"use client"

import Link from "next/link"
import {
  CandlestickChartIcon,
  ListChecksIcon,
  RadioIcon,
} from "lucide-react"
import { LineMask } from "@/components/marketing/motion/line-mask"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"

/**
 * ABOUT — set directly on the page, not in a panel. The statement sits left
 * and the paragraph right on the same baseline grid, then the three pillars
 * run the full width beneath a hairline. No card, no overlap, no shadow: the
 * section takes the body's own background and earns its edges from type and
 * spacing alone.
 */

const PILLARS = [
  {
    icon: ListChecksIcon,
    title: "Structured curriculum",
    line: "Courses built lesson by lesson toward an exam — not a playlist of clips.",
  },
  {
    icon: CandlestickChartIcon,
    title: "Instructors who trade",
    line: "Every course is written and taught by someone who trades for a living.",
  },
  {
    icon: RadioIcon,
    title: "Live community",
    line: "Scheduled live sessions, plus direct messages with your instructor.",
  },
] as const

export function AboutBand() {
  return (
    <section className="relative py-24 md:py-32" aria-label="About the academy">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            About
          </p>

          {/* Statement left, argument right — aligned to one top edge. */}
          <div className="mt-8 grid gap-x-16 gap-y-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <LineMask
              as="h2"
              mode="inview"
              className="font-display text-[clamp(2rem,4.4vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.025em] text-ws-primary"
              lines={[
                { text: "Structured like a school," },
                { text: "taught from the floor.", className: "text-ws-gold" },
              ]}
            />

            <div className="lg:pt-2">
              <p className="max-w-xl text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
                WorldStreet Academy is structured trading education: courses
                built and taught by working traders, live sessions where you ask
                in the moment, and a timed exam standing between the last lesson
                and your signed certificate.
              </p>
              <Link
                href="/courses"
                className="group mt-7 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ws-gold"
              >
                <span className="relative">
                  Browse the catalogue
                  <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-ws-gold transition-transform duration-200 ease-[var(--ws-ease)] group-hover:scale-x-100" />
                </span>
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          </div>
        </RevealGroup>

        {/* Pillars — full width, one hairline, three equal columns. */}
        <div className="mt-20 grid gap-10 border-t border-ws-hairline pt-12 sm:grid-cols-3 sm:gap-8 md:mt-24">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 0.09} y={18} duration={0.6}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
                <pillar.icon size={16} />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-ws-primary">
                {pillar.title}
              </h3>
              <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-ws-muted">
                {pillar.line}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
