import type { SchoolSlug } from "@/lib/schools"
import { SCHOOLS } from "@/lib/schools"
import { BRAND } from "@/lib/brand"
import { SchoolCard } from "@/components/marketing/school-card"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

/**
 * OUR SCHOOLS (spec §4) — eight image-led cards, four across from lg. With
 * cover art the schools no longer read as near-identical items, so the
 * marketplace grid (blueprint §18) replaces the directory. Counts and prices
 * come from the landing's single fetch.
 */
export function SchoolsGrid({
  counts,
  cheapest,
}: {
  counts: Record<SchoolSlug, number>
  cheapest: Record<SchoolSlug, number | null>
}) {
  return (
    <section id="schools" className="relative scroll-mt-24 py-14 sm:py-20 md:py-28" aria-labelledby="schools-heading">
      <div className="mx-auto max-w-7xl px-6">
        <RevealGroup>
          <SectionLabel>Our schools</SectionLabel>
          <SectionTitle id="schools-heading" className="mt-4 max-w-2xl">
            Explore the Schools of {BRAND.name}
          </SectionTitle>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
            Your future can take many directions. Choose the school that matches
            your interests, goals and ambitions.
          </p>
        </RevealGroup>

        {/* amount: the default 30% can never be in view on a phone, where
            the eight stacked cards run ~3,700px against an ~840px screen. */}
        <Reveal y={20} duration={0.65} amount={0.05} className="mt-10 md:mt-12">
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SCHOOLS.map((school) => (
              <li key={school.slug}>
                <SchoolCard school={school} count={counts[school.slug]} fromPrice={cheapest[school.slug]} />
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
