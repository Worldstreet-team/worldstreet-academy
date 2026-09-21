import Link from "next/link"
import { ArrowRightIcon, CompassIcon } from "lucide-react"
import { SCHOOLS, type School, type SchoolSlug } from "@/lib/schools"
import { cn } from "@/lib/utils"
import { plural } from "@/components/programs/format"
import { SchoolCard } from "@/components/marketing/school-card"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"

/**
 * `#other-schools` — the seven other schools, as the landing and /schools
 * show them (`SchoolCard`, unchanged), starting with the one after this
 * school and wrapping round. The eighth tile is the way out to the whole
 * catalogue, so four across closes on two full rows.
 */
export function OtherSchools({
  school,
  counts,
  cheapest,
  total,
}: {
  school: School
  counts: Record<SchoolSlug, number>
  cheapest: Record<SchoolSlug, number | null>
  /** Published programs across the catalogue. */
  total: number
}) {
  const at = SCHOOLS.findIndex((s) => s.slug === school.slug)
  const others = [...SCHOOLS.slice(at + 1), ...SCHOOLS.slice(0, at)]

  return (
    // The FAQ above carries its own deep bottom padding, so this section adds only a little.
    <section id="other-schools" aria-labelledby="other-schools-heading" className={cn(SCHOOL_SECTION, "pt-4 md:pt-6")}>
      <SectionHead
        id="other-schools-heading"
        title="Explore the other schools"
        aside={
          <Link
            href="/schools"
            className="inline-flex items-center gap-1.5 rounded-sm text-[14px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            All schools
            <ArrowRightIcon size={15} aria-hidden />
          </Link>
        }
      />
      {/* Phones: a swipeable row (eight stacked cards would be a page of
          their own); from sm a grid, four across from lg. */}
      <ul className="no-scrollbar -mx-6 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {others.map((s) => (
          <li key={s.slug} className="w-[80%] shrink-0 snap-start sm:w-auto">
            <SchoolCard school={s} count={counts[s.slug]} fromPrice={cheapest[s.slug]} />
          </li>
        ))}
        <li className="w-[80%] shrink-0 snap-start sm:w-auto">
          <Link
            href="/programs"
            data-school="browse-all"
            className="ws-school group flex h-full flex-col overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-sunken transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            <div className="flex aspect-[16/10] items-center justify-center border-b border-ws-hairline text-ws-muted">
              <span className="ws-school-glyph">
                <CompassIcon size={44} aria-hidden />
              </span>
            </div>
            <div className="flex flex-1 flex-col px-6 pb-6 pt-9">
              <h3 className="font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
                Every program in one list
              </h3>
              <p className="mb-6 mt-2 text-[14px] leading-relaxed text-ws-muted">
                Across all eight schools, with each one&apos;s level and price.
              </p>
              <span className="mt-auto flex items-center justify-between gap-3 border-t border-ws-hairline pt-4 text-[13px]">
                <span className="tabular-nums text-ws-muted">{plural(total, "program")}</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
                  Browse all
                  <ArrowRightIcon
                    size={14}
                    aria-hidden
                    className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </span>
            </div>
          </Link>
        </li>
      </ul>
    </section>
  )
}
