"use client"

import {
  CompassIcon,
  GaugeIcon,
  GraduationCapIcon,
  HammerIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import { LineMask } from "@/components/marketing/motion/line-mask"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { BRAND } from "@/lib/brand"

/**
 * WHY (spec §3) — same grammar as the About band: statement left, argument
 * right on one baseline, then the six pillars full-width under a hairline.
 * No card, no panel: the section takes the page's own background.
 */
const PILLARS = [
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
] as const

export function WhyBand() {
  return (
    <section className="relative py-24 md:py-32" aria-label={`Why learn with ${BRAND.name}`}>
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            Why {BRAND.wordmark}
          </p>

          <div className="mt-8 grid gap-x-16 gap-y-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <LineMask
              as="h2"
              mode="inview"
              className="font-display text-[clamp(2rem,4.4vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.025em] text-ws-primary"
              lines={[
                { text: "Why learn with" },
                { text: BRAND.wordmark, className: "text-ws-gold" },
                { text: `${BRAND.eyebrow}?`, className: "text-ws-gold" },
              ]}
            />

            <p className="max-w-xl text-[16px] leading-relaxed text-ws-muted md:text-[17px] lg:pt-2">
              Because the world is changing. The skills that create opportunities
              today are not necessarily the skills that created opportunities
              yesterday. {BRAND.name} is built around the skills shaping tomorrow.
            </p>
          </div>
        </RevealGroup>

        {/* Pillars — full width, one hairline, 1 → 2 → 3 columns. */}
        <div className="mt-20 grid gap-10 border-t border-ws-hairline pt-12 sm:grid-cols-2 sm:gap-8 md:mt-24 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={(i % 3) * 0.09} y={18} duration={0.6}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
                <pillar.icon size={16} />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-ws-primary">{pillar.title}</h3>
              <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-ws-muted">{pillar.line}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
