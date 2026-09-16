"use client"

import {
  CompassIcon,
  GaugeIcon,
  GraduationCapIcon,
  HammerIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import { BRAND } from "@/lib/brand"

/**
 * WHY (spec §3). Title left and the "Because the world is changing" lede
 * right, bottom-aligned on one row — a different opening from the About
 * statement above it and the Schools directory below. The six pillars are
 * v2 cards (04-components → Card): `card` fill, 20px corners, separated by
 * fill in dark and a hairline in light, never a border-drawn box. 44px gold
 * chip, Poppins title, one line each. Copy is §3 verbatim.
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
    <section className="relative py-14 sm:py-20 md:py-28" aria-labelledby="why-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup className="grid gap-x-16 gap-y-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <SectionLabel>Why {BRAND.wordmark}</SectionLabel>
            <SectionTitle id="why-heading" className="mt-4 max-w-xl">
              Why learn with {BRAND.name}?
            </SectionTitle>
          </div>
          <p className="max-w-lg text-[16px] leading-relaxed text-ws-muted md:text-[17px] lg:pb-1">
            Because the world is changing. The skills that create opportunities
            today are not necessarily the skills that created opportunities
            yesterday. {BRAND.name} is built around the skills shaping tomorrow.
          </p>
        </RevealGroup>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 md:mt-12 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <Reveal as="li" key={pillar.title} delay={(i % 3) * 0.07} y={18} duration={0.6}>
              <div className="flex h-full flex-col rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent sm:p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ws-brand/[0.12] text-ws-gold">
                  <pillar.icon size={20} strokeWidth={1.75} />
                </span>
                <h3 className="mt-7 font-display text-[19px] font-semibold leading-snug tracking-[-0.015em] text-ws-primary">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ws-muted">{pillar.line}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
