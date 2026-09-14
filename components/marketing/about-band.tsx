"use client"

import Link from "next/link"
import { LineMask } from "@/components/marketing/motion/line-mask"
import { RevealGroup } from "@/components/marketing/motion/reveal"
import { BRAND } from "@/lib/brand"

/**
 * ABOUT (spec §2) — set directly on the page, not in a panel. The statement
 * sits left and the argument right on the same baseline grid. The old
 * three-pillar strip is gone: the six spec pillars live in WhyBand, directly
 * below, and saying it twice was the one thing the old page did wrong.
 */
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
                { text: "Welcome to" },
                { text: BRAND.wordmark, className: "text-ws-gold" },
                { text: `${BRAND.eyebrow}.`, className: "text-ws-gold" },
              ]}
            />

            <div className="space-y-4 text-[16px] leading-relaxed text-ws-muted md:text-[17px] lg:pt-2">
              <p className="max-w-xl">
                {BRAND.name} is the education and skills development arm of the
                WorldStreet ecosystem.
              </p>
              <p className="max-w-xl">
                Our purpose is simple: To help people learn valuable skills,
                develop practical capabilities and create opportunities for
                themselves in the new economy.
              </p>
              <p className="max-w-xl">
                We bring together expert instructors, structured programs,
                practical learning experiences, mentorship and a growing
                ecosystem of opportunities.
              </p>
              <p className="max-w-xl">
                From financial markets to artificial intelligence, from
                blockchain to cybersecurity, from content creation to digital
                business, {BRAND.name} is designed to help you move from
                interest to knowledge, knowledge to skill, and skill to
                opportunity.
              </p>
              <Link
                href="/schools"
                className="group inline-flex items-center gap-1.5 pt-3 text-[14px] font-semibold text-ws-gold"
              >
                <span className="relative">
                  Explore the schools
                  <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-ws-gold transition-transform duration-200 ease-[var(--ws-ease)] group-hover:scale-x-100" />
                </span>
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          </div>
        </RevealGroup>
      </div>
    </section>
  )
}
