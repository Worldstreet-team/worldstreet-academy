import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { School, SchoolSlug } from "@/lib/schools"
import { SCHOOLS } from "@/lib/schools"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { SchoolIcon } from "@/components/shared/school-icon"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SectionLabel, SectionTitle } from "@/components/marketing/section-heading"

/**
 * OUR SCHOOLS (spec §4) — a directory, not a card grid. Eight rows in the
 * ListRow grammar (04-components): gold rounded-square chip, name, blurb,
 * program count tabular on the right, hairline-divided inside ONE 20px panel
 * that splits into two columns from md. Cards for eight near-identical items
 * read as a product grid; a directory reads as an institution's index, which
 * is what "Explore our schools" (the hero's primary CTA) lands on.
 *
 * Program counts come from the landing's single fetch
 * (`countProgramsBySchool`), never a second query. The whole row is the link.
 */
export function SchoolsGrid({ counts }: { counts: Record<SchoolSlug, number> }) {
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

        <Reveal y={20} duration={0.65} className="mt-10 md:mt-12">
          <ul className="overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent md:grid md:grid-cols-2">
            {SCHOOLS.map((school, i) => (
              <li
                key={school.slug}
                className={cn(
                  "border-t border-ws-hairline",
                  i === 0 && "border-t-0",
                  i === 1 && "md:border-t-0",
                  i % 2 === 1 && "md:border-l"
                )}
              >
                <SchoolRow school={school} count={counts[school.slug]} />
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

function SchoolRow({ school, count }: { school: School; count: number }) {
  const programs = count === 1 ? "1 program" : `${count} programs`
  return (
    <Link
      href={`/schools/${school.slug}`}
      className="group flex h-full items-start gap-4 px-5 py-5 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40 sm:px-6 sm:py-6"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ws-brand/[0.12] text-ws-gold">
        <SchoolIcon name={school.icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-display text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary md:text-[17px]">
          {school.name}
        </h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ws-muted">{school.blurb}</p>
        <span className="mt-2 text-[12.5px] tabular-nums text-ws-muted sm:hidden">{programs}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5 pt-0.5 text-[13px] tabular-nums text-ws-muted">
        <span className="hidden sm:inline">{programs}</span>
        <ArrowRightIcon
          size={16}
          aria-hidden
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  )
}
