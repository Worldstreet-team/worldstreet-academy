import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { programPriceLabel } from "@/lib/program-price"
import { cn } from "@/lib/utils"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"
import { LEVEL_LABEL, levelsOf, sizeLine, type SchoolProgram } from "@/components/schools/model"

/**
 * `#path` — the school's programs as a route from beginner to advanced. Only
 * when the programs span two or more levels; one level is not a path. The
 * steps are the levels the programs really have, in ladder order, so the
 * numbering is a true sequence. A track runs through the step markers —
 * across on lg, down the left edge below it.
 */
export function SchoolPath({ programs }: { programs: SchoolProgram[] }) {
  const levels = levelsOf(programs)
  if (levels.length < 2) return null
  const steps = levels.map((level) => ({ level, items: programs.filter((p) => p.program.level === level) }))

  return (
    <section id="path" aria-labelledby="path-heading" className={SCHOOL_SECTION}>
      <SectionHead
        id="path-heading"
        title="Suggested path"
        lede="Begin at the level that fits you and move up. The programs in order, from beginner to advanced."
      />

      <ol className={cn("mt-12 grid lg:gap-x-6", steps.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
        {steps.map((step, i) => {
          const last = i === steps.length - 1
          return (
            <li key={step.level} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-5 lg:block">
              <div className="flex flex-col items-center lg:flex-row">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ws-raised font-display text-[15px] font-semibold tabular-nums text-ws-primary">
                  <span className="sr-only">Step </span>
                  {i + 1}
                </span>
                {!last && (
                  <span aria-hidden className="my-2 w-px flex-1 bg-ws-hairline lg:mx-0 lg:my-0 lg:-mr-6 lg:ml-4 lg:h-px lg:w-auto" />
                )}
              </div>

              <div className={cn("min-w-0 pt-1.5 lg:pr-6 lg:pt-6", !last && "pb-10 lg:pb-0")}>
                <h3 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-ws-primary">
                  {LEVEL_LABEL[step.level]}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {step.items.map(({ program, facts }) => {
                    const size = sizeLine(facts)
                    return (
                      <li key={program.id}>
                        <Link
                          href={`/programs/${program.slug}`}
                          className="group flex items-center gap-4 rounded-[14px] border border-ws-hairline bg-ws-surface px-4 py-3.5 transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 block text-[15px] font-semibold leading-snug text-ws-primary">
                              {program.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] tabular-nums text-ws-muted">
                              {[programPriceLabel(program), ...size].join(" · ")}
                            </span>
                          </span>
                          <ArrowRightIcon
                            size={16}
                            aria-hidden
                            className="shrink-0 text-ws-muted transition-transform duration-[var(--ws-motion-base)] group-hover:translate-x-0.5 group-hover:text-ws-primary motion-reduce:transition-none"
                          />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
