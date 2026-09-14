import type { SchoolSlug } from "@/lib/schools"
import { SCHOOLS } from "@/lib/schools"
import { BRAND } from "@/lib/brand"
import { SchoolCard } from "@/components/marketing/school-card"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"

/**
 * OUR SCHOOLS (spec §4) — heading copy verbatim, then the eight cards in
 * 1 → 2 → 4 columns. Program counts come from the landing's single fetch
 * (`countProgramsBySchool`), never a second query.
 */
export function SchoolsGrid({ counts }: { counts: Record<SchoolSlug, number> }) {
  return (
    <section id="schools" className="relative scroll-mt-24 py-24 md:py-32" aria-label="Our schools">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            Our schools
          </p>
          <h2
            className="mt-4 max-w-3xl font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            Explore the Schools of {BRAND.name}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            Your future can take many directions. Choose the school that matches
            your interests, goals and ambitions.
          </p>
        </RevealGroup>

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SCHOOLS.map((school, i) => (
            <Reveal as="li" key={school.slug} delay={(i % 4) * 0.06} y={20} duration={0.6}>
              <SchoolCard school={school} count={counts[school.slug]} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
