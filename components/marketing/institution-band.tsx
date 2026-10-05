import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

/** Three small proof points under the statement. */
const POINTS = [
  {
    title: "From point A to point B",
    body: "A clear path from where your finances are today to where you want them to be.",
  },
  {
    title: "Our systems, shown openly",
    body: "We walk you through how we work and the model behind it — not theory from a distance.",
  },
  {
    title: "Experts who share the vision",
    body: "Taught by practitioners committed to your progress, not just to the lesson.",
  },
] as const

/**
 * WHO WE ARE — the owner's own framing (Bason, owner meeting 2026-10-03,
 * paraphrased): an institution invested in its learners' financial
 * prosperity, taking them from point A to point B through its own systems
 * and model, taught by experts committed to the vision. A headline, two
 * short lines and three proof points, in the landing's section rhythm
 * (label · title · body, then a hairline-ruled row). Sits right after the
 * live cohort band.
 */
export function InstitutionBand() {
  return (
    <section className="py-14 sm:py-20 md:py-28" aria-labelledby="institution-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <SectionLabel>Who we are</SectionLabel>
          <SectionTitle id="institution-heading" className="mt-4 max-w-3xl">
            A different kind of institution — one invested in your financial prosperity.
          </SectionTitle>
          <div className="mt-6 max-w-2xl space-y-3 text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
            <p>
              We take you from point A to point B: a complete transformation in your finances, not a certificate on
              a shelf.
            </p>
            <p>You learn our systems and our model step by step, from experts committed to the same vision.</p>
          </div>
        </RevealGroup>

        <ul className="mt-10 grid gap-6 sm:grid-cols-3 md:mt-14">
          {POINTS.map((point, i) => (
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
