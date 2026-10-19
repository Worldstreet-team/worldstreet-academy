import Link from "next/link"
import { ArrowRightIcon } from "@/components/icons"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"
import type { StudyAreaLink } from "@/lib/schools"

/**
 * `#areas` — "Study areas": the school's areas in institutional blueprint §7
 * order (§8, D22). An area whose program is published links to it; any other
 * is a quiet "Coming soon" tile, not a link. Ink and muted only: no gold.
 */
export function SchoolAreas({ areas }: { areas: StudyAreaLink[] }) {
  if (areas.length === 0) return null
  const open = areas.filter((a) => a.program).length

  return (
    <section id="areas" aria-labelledby="areas-heading" className={SCHOOL_SECTION}>
      <SectionHead
        id="areas-heading"
        title="Study areas"
        lede="Areas with an open program link to it. The rest are coming soon."
        aside={
          open > 0 ? (
            <p className="text-[14px] tabular-nums text-ws-muted">{`${open} of ${areas.length} open`}</p>
          ) : undefined
        }
      />

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) =>
          area.program ? (
            <Link
              key={area.name}
              href={area.program.href}
              className="ws-icon-mono group flex items-start justify-between gap-4 rounded-[20px] border border-ws-hairline p-5 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-ws-primary">{area.name}</span>
                <span className="mt-1 block text-[13px] text-ws-muted">{area.program.title}</span>
              </span>
              <ArrowRightIcon aria-hidden className="mt-1 size-5 shrink-0" />
            </Link>
          ) : (
            <div
              key={area.name}
              className="flex items-start justify-between gap-4 rounded-[20px] border border-dashed border-ws-hairline p-5"
            >
              <span className="min-w-0 text-ws-muted">{area.name}</span>
              <span className="shrink-0 rounded-full bg-ws-raised px-2.5 py-1 text-[12px] font-semibold text-ws-muted">
                Coming soon
              </span>
            </div>
          )
        )}
      </div>
    </section>
  )
}
