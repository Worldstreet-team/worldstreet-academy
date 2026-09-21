import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon, CheckIcon, StarIcon } from "lucide-react"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { cn } from "@/lib/utils"
import { plural } from "@/components/programs/format"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"
import { compareGroups, type CompareCell, type SchoolProgram } from "@/components/schools/model"

/**
 * `#compare` — the programs side by side (Coursera's "compare programs"), so
 * a visitor can choose without opening each page. Rendered only with two or
 * more programs. Every cell comes from the program's own data
 * (`compareGroups`): a dash means that program doesn't have it yet, and a
 * row no program has is left out. The group headings say how to read their
 * rows — a cell naming a package means that package adds the service.
 *
 * A real table: row and column headers, a caption for assistive tech. On a
 * phone two programs fit without sideways scrolling; with more, the table
 * scrolls inside its own card (never the page) with the row labels pinned.
 */
export function SchoolCompare({ programs, schoolName }: { programs: SchoolProgram[]; schoolName: string }) {
  if (programs.length < 2) return null
  const groups = compareGroups(programs)
  const wide = programs.length > 2

  return (
    <section id="compare" aria-labelledby="compare-heading" className={SCHOOL_SECTION}>
      <SectionHead
        id="compare-heading"
        title="Compare programs"
        lede="What each program costs, what it holds today, and which package adds each service."
      />

      <div className="mt-10 overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent">
        <div className="overflow-x-auto">
          <table
            className={cn("w-full border-collapse text-left text-[14px]", wide && "min-w-[44rem]")}
            style={{ tableLayout: "fixed" }}
          >
            <caption className="sr-only">The programs of the {schoolName}, compared</caption>
            <colgroup>
              <col className="w-[6.75rem] sm:w-[11rem] lg:w-[14rem]" />
              {programs.map(({ program }) => (
                <col key={program.id} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-ws-surface p-3 sm:p-6">
                  <span className="sr-only">Program</span>
                </th>
                {programs.map(({ program }) => (
                  <th key={program.id} scope="col" className="p-3 align-bottom font-normal sm:p-6">
                    <Link
                      href={`/programs/${program.slug}`}
                      className="group block rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                    >
                      <span className="relative block aspect-[16/9] w-full max-w-[15rem] overflow-hidden rounded-[10px] bg-ws-sunken">
                        {program.thumbnailUrl && (
                          <Image src={program.thumbnailUrl} alt="" fill sizes="240px" className="object-cover" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "mt-3 block text-balance font-display text-[15px] font-semibold leading-snug text-ws-primary decoration-ws-hairline underline-offset-4 group-hover:underline",
                          !wide && "sm:text-[17px]"
                        )}
                      >
                        {program.title}
                      </span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.title}>
                <tr className="border-t border-ws-hairline">
                  <th scope="colgroup" colSpan={programs.length + 1} className="bg-ws-sunken p-0 text-left">
                    <span className="sticky left-0 block px-3 py-3 text-[13px] font-semibold text-ws-primary sm:px-6">
                      {group.title}
                    </span>
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="border-t border-ws-hairline">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-ws-surface px-3 py-4 align-top text-[13px] font-medium text-ws-muted sm:px-6 sm:text-[14px]"
                    >
                      {row.label}
                    </th>
                    {row.cells.map((cell, i) => (
                      <td key={programs[i].program.id} className="px-3 py-4 align-top text-ws-primary sm:px-6">
                        <Cell cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
            <tbody>
              <tr className="border-t border-ws-hairline">
                <th scope="row" className="sticky left-0 z-10 bg-ws-surface px-3 py-5 sm:px-6">
                  <span className="sr-only">Program page</span>
                </th>
                {programs.map(({ program }) => (
                  <td key={program.id} className="px-3 py-5 sm:px-6">
                    <Link
                      href={`/programs/${program.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-sm text-[14px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
                    >
                      View program
                      <span className="sr-only">: {program.title}</span>
                      <ArrowRightIcon size={14} aria-hidden className="hidden shrink-0 sm:block" />
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Cell({ cell }: { cell: CompareCell }) {
  if (!cell) {
    return (
      <span className="text-ws-subtle">
        <span aria-hidden>—</span>
        <span className="sr-only">Not listed</span>
      </span>
    )
  }
  switch (cell.kind) {
    case "text":
      return (
        <span className="block">
          <span className={cn("tabular-nums", cell.capitalize && "capitalize")}>{cell.text}</span>
          {cell.sub && <span className="mt-0.5 block text-[12.5px] leading-snug text-ws-muted">{cell.sub}</span>}
        </span>
      )
    case "included":
      return (
        <span className="inline-flex items-center gap-2">
          <CheckIcon size={16} aria-hidden className="shrink-0 text-ws-primary" />
          Included
        </span>
      )
    case "tier":
      return (
        <span className="block leading-snug">
          <span className="text-ws-muted">With </span>
          {PACKAGE_LABEL[cell.tier]}
          <span className="sr-only"> package</span>
        </span>
      )
    case "rating":
      return (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 tabular-nums">
          <StarIcon size={14} fill="currentColor" strokeWidth={0} className="text-ws-rating" aria-hidden />
          <span className="font-semibold">{cell.rating.toFixed(1)}</span>
          <span className="text-[12.5px] text-ws-muted">({plural(cell.count, "rating")})</span>
        </span>
      )
  }
}
