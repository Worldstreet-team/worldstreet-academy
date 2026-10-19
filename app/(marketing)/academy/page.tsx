import type { Metadata } from "next"
import Link from "next/link"

import { Chain } from "@/components/academy/chain"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import { WorldsBand } from "@/components/marketing/worlds-band"
import { appUrl } from "@/lib/app-url"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"
import {
  ACADEMY_LINE,
  BIGGER_VISION,
  CLOSING_BANNER,
  COMBINES,
  CORE_PROPOSITION,
  CORE_TRANSFORMATION,
  DEFINITION,
  ECOSYSTEM,
  GAPS,
  JOURNEY,
  JOURNEY_EXAMPLES,
  MISSION,
  PURPOSE,
  VALUE_LINE,
  VISION,
  WEALTH_LIQUEFACTION,
  WEALTH_LIQUEFACTION_DEFINITION,
} from "@/lib/institution"

export const metadata: Metadata = {
  title: "The Academy",
  description: BRAND.descriptor,
  alternates: { canonical: appUrl("/academy") },
}

const SECTION = "py-14 sm:py-20 md:py-24"
const WRAP = "mx-auto max-w-7xl px-6"
const BODY = "max-w-3xl text-[16px] leading-relaxed text-ws-muted md:text-[17px]"
const CARD = "rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent"
const GOLD_CTA =
  "inline-flex h-12 items-center justify-center rounded-full bg-ws-brand px-9 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
const OUTLINE_CTA =
  "inline-flex h-12 items-center justify-center rounded-full border border-ws-hairline px-8 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"

/** /academy: the institution, in the institutional blueprint's order (§1–§23). Static; no data fetch. */
export default function AcademyPage() {
  return (
    <main>
      <section className={`${SECTION} md:pt-32`} aria-labelledby="academy-heading">
        <div className={WRAP}>
          <RevealGroup>
            <SectionLabel>{BRAND.name}</SectionLabel>
            <h1
              id="academy-heading"
              className="mt-4 max-w-4xl font-display text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ws-primary"
            >
              {BRAND.tagline}
            </h1>
            <p className={`mt-6 ${BODY}`}>{DEFINITION}</p>
          </RevealGroup>
        </div>
      </section>

      <section id="big-idea" className={SECTION} aria-labelledby="big-idea-heading">
        <div className={WRAP}>
          <RevealGroup>
            <SectionLabel>Our philosophy</SectionLabel>
            <SectionTitle id="big-idea-heading" className="mt-4">
              The big idea
            </SectionTitle>
          </RevealGroup>
          <Reveal className="mt-8 max-w-4xl">
            <blockquote className="border-l-2 border-ws-hairline pl-5 font-display text-[clamp(1.375rem,2.6vw,2.125rem)] font-light leading-[1.25] tracking-[-0.02em] text-ws-primary">
              {PURPOSE}
            </blockquote>
          </Reveal>
          <Reveal className={`mt-8 ${BODY}`}>
            <p>
              This Academy is not simply an online course platform. It is designed to function as a modern institution
              of learning, combining:
            </p>
            <ul className="mt-4 grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2">
              {COMBINES.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span aria-hidden className="mt-[0.65em] size-1 shrink-0 rounded-full bg-ws-subtle" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section id="wealth-liquefaction" className={SECTION} aria-labelledby="wl-heading">
        <div className={WRAP}>
          <RevealGroup>
            <SectionLabel>Our philosophy</SectionLabel>
            <SectionTitle id="wl-heading" className="mt-4">
              Wealth Liquefaction
            </SectionTitle>
          </RevealGroup>
          <Reveal className="mt-8">
            <Chain steps={WEALTH_LIQUEFACTION} label="Wealth Liquefaction" />
          </Reveal>
          <Reveal className={`mt-8 space-y-4 ${BODY}`}>
            <p>{WEALTH_LIQUEFACTION_DEFINITION}</p>
            <p className="font-semibold text-ws-primary">{VALUE_LINE}</p>
          </Reveal>
        </div>
      </section>

      <section id="vision" className={SECTION} aria-labelledby="vision-heading">
        <div className={WRAP}>
          <RevealGroup>
            <SectionLabel>Where we are going</SectionLabel>
            <SectionTitle id="vision-heading" className="mt-4">
              Our vision
            </SectionTitle>
            <p className={`mt-6 ${BODY}`}>{VISION}</p>
          </RevealGroup>
        </div>
      </section>

      <section id="mission" className={SECTION} aria-labelledby="mission-heading">
        <div className={WRAP}>
          <RevealGroup>
            <SectionLabel>What we do</SectionLabel>
            <SectionTitle id="mission-heading" className="mt-4">
              Our mission
            </SectionTitle>
            <p className={`mt-6 ${BODY}`}>{MISSION}</p>
          </RevealGroup>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {GAPS.map((gap, i) => (
              <Reveal as="li" key={gap.title} delay={i * 0.06} y={16} className={CARD}>
                <p className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ws-primary">{gap.title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-ws-muted">{gap.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section id="journey" className={SECTION} aria-labelledby="journey-heading">
        <div className={WRAP}>
          <RevealGroup>
            <SectionLabel>The learner</SectionLabel>
            <SectionTitle id="journey-heading" className="mt-4">
              The 5-stage Mastery Journey
            </SectionTitle>
          </RevealGroup>
          <ol className="mt-10 grid gap-5 md:grid-cols-6 lg:grid-cols-5">
            {JOURNEY.map((stage, i) => (
              <Reveal as="li" key={stage.name} delay={i * 0.05} y={16} className={cn(CARD, "md:col-span-2 lg:col-span-1", i === 3 && "md:col-start-2 lg:col-start-auto")}>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-muted">
                  Stage {i + 1} — {stage.name}
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-ws-muted">{stage.body}</p>
              </Reveal>
            ))}
          </ol>
          <div className="mt-10 space-y-6">
            {JOURNEY_EXAMPLES.map((steps, i) => (
              <Reveal key={i}>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-muted">Example {i + 1}</p>
                <Chain steps={steps} label={`Example ${i + 1}`} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div id="worlds">
        <WorldsBand />
      </div>

      <section id="ecosystem" className={SECTION} aria-labelledby="ecosystem-heading">
        <div className={WRAP}>
          <RevealGroup>
            <SectionLabel>The ecosystem</SectionLabel>
            <SectionTitle id="ecosystem-heading" className="mt-4">
              How it fits together
            </SectionTitle>
            <p className={`mt-6 ${BODY}`}>{ECOSYSTEM}</p>
          </RevealGroup>
        </div>
      </section>

      <section id="transformation" className={SECTION} aria-labelledby="transformation-heading">
        <div className={WRAP}>
          <RevealGroup>
            <SectionLabel>The proposition</SectionLabel>
            <SectionTitle id="transformation-heading" className="mt-4">
              The core transformation
            </SectionTitle>
          </RevealGroup>
          <Reveal className="mt-8">
            <Chain steps={CORE_TRANSFORMATION} label="The core transformation" />
          </Reveal>
          <Reveal className={`mt-8 ${BODY}`}>
            <p>{CORE_PROPOSITION}</p>
          </Reveal>
        </div>
      </section>

      <section className="py-16 sm:py-24 md:py-32" aria-labelledby="close-heading">
        <div className={`${WRAP} text-center`}>
          <RevealGroup>
            <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[16px]">
              {BIGGER_VISION.contrast}
            </p>
            <h2
              id="close-heading"
              className="mx-auto mt-5 max-w-4xl font-display text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-ws-primary"
            >
              {BIGGER_VISION.question}
            </h2>
            <p className="mt-6 text-[16px] font-semibold text-ws-primary">{ACADEMY_LINE}</p>
          </RevealGroup>
          <Reveal className="mx-auto mt-9 flex max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
            <Link href="/schools" className={GOLD_CTA}>
              Explore the Academy
            </Link>
            <Link href="/teach" className={OUTLINE_CTA}>
              Become a WMA Instructor
            </Link>
          </Reveal>
        </div>
      </section>

      {/* §23's closing banner: the brand's sign-off, the page's last word. */}
      <div className="border-t border-ws-hairline py-10 md:py-12">
        <Reveal as="p" className={`${WRAP} text-balance text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-ws-gold md:text-[13px]`}>
          {CLOSING_BANNER}
        </Reveal>
      </div>
    </main>
  )
}
