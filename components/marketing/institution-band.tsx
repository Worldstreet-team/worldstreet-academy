import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"
import { GAPS, MISSION } from "@/lib/institution"

/**
 * OUR MISSION (institutional blueprint §4) — the mission and the three gaps it
 * closes, in the landing section rhythm (label, title, body, then a
 * hairline-ruled row). Sits right after the live cohort band. §4 superseded
 * the 2026-10-03 "Who we are" text ("point A to point B"). Copy lives in
 * lib/institution.ts.
 */
export function InstitutionBand() {
  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="institution-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <SectionLabel>Our mission</SectionLabel>
          <SectionTitle id="institution-heading" className="mt-4 max-w-3xl">
            The Academy exists to close three major gaps.
          </SectionTitle>
          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-ws-muted md:text-[17px]">{MISSION}</p>
        </RevealGroup>

        <ul className="mt-10 grid gap-6 sm:grid-cols-3 md:mt-14">
          {GAPS.map((point, i) => (
            <Reveal as="li" key={point.title} delay={i * 0.06} y={16} className="border-t border-ws-hairline pt-5">
              <p className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ws-primary">{point.title}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ws-muted">{point.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
