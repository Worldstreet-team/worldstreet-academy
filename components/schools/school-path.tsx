import { ArrowRightIcon } from "@/components/icons"
import Link from "next/link"

import { JOURNEY, JOURNEY_EXAMPLES } from "@/lib/institution"
import { programPriceLabel } from "@/lib/program-price"
import { cn } from "@/lib/utils"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"
import { LEVEL_LABEL, levelsOf, sizeLine, type SchoolProgram } from "@/components/schools/model"

/** §5's two worked examples belong to these schools; the others print none. */
const EXAMPLE_FOR: Partial<Record<string, (typeof JOURNEY_EXAMPLES)[number]>> = {
  "creative-economy": JOURNEY_EXAMPLES[0],
  "technology-ai": JOURNEY_EXAMPLES[1],
}

type Step = { key: string; title: string; body: string | null; items: SchoolProgram[] }

/**
 * `#path` — institutional blueprint §8's "Learning pathways". When the
 * programs span two or more levels, the steps are those levels in ladder
 * order (beginner → advanced), each listing its programs. Otherwise the path
 * is §5's 5-stage Mastery Journey, which every program follows, with the
 * school's programs under "Learn". A track runs through the step markers —
 * across on lg, down the left edge below it.
 */
export function SchoolPath({ programs, schoolSlug }: { programs: SchoolProgram[]; schoolSlug: string }) {
  if (programs.length === 0) return null
  const levels = levelsOf(programs)
  const byLevels = levels.length > 1
  const steps: Step[] = byLevels
    ? levels.map((level) => ({
        key: level,
        title: LEVEL_LABEL[level],
        body: null,
        items: programs.filter((p) => p.program.level === level),
      }))
    : JOURNEY.map((stage) => ({
        key: stage.name,
        title: stage.name,
        body: stage.body,
        items: stage.name === "Learn" ? programs : [],
      }))
  const example = byLevels ? undefined : EXAMPLE_FOR[schoolSlug]

  return (
    <section id="path" aria-labelledby="path-heading" className={SCHOOL_SECTION}>
      <SectionHead
        id="path-heading"
        title="Learning pathways"
        lede={
          byLevels
            ? "Begin at the level that fits you and move up. The programs in order, from beginner to advanced."
            : "Every program here follows the WMA Mastery Journey: five stages from discovering a field to turning your mastery into economic value."
        }
      />

      <ol
        className={cn(
          "mt-12 grid lg:gap-x-6",
          steps.length === 2 ? "lg:grid-cols-2" : steps.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-5"
        )}
      >
        {steps.map((step, i) => {
          const last = i === steps.length - 1
          return (
            <li key={step.key} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-5 lg:block">
              <div className="flex flex-col items-center lg:flex-row">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ws-raised font-display text-[15px] font-semibold tabular-nums text-ws-primary">
                  <span className="sr-only">{byLevels ? "Step " : "Stage "}</span>
                  {i + 1}
                </span>
                {!last && (
                  <span aria-hidden className="my-2 w-px flex-1 bg-ws-hairline lg:mx-0 lg:my-0 lg:-mr-6 lg:ml-4 lg:h-px lg:w-auto" />
                )}
              </div>

              <div className={cn("min-w-0 pt-1.5 lg:pr-6 lg:pt-6", !last && "pb-10 lg:pb-0")}>
                <h3 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-ws-primary">
                  {step.title}
                </h3>
                {step.body && <p className="mt-2 text-pretty text-[14px] leading-relaxed text-ws-muted">{step.body}</p>}
                {step.items.length > 0 && (
                  <ul className="mt-4 space-y-2.5">
                    {step.items.map(({ program, facts }) => {
                      const size = byLevels ? sizeLine(facts) : []
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
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {example && (
        <p className="mt-10 text-pretty text-[14px] leading-relaxed text-ws-muted">
          <span className="font-semibold text-ws-primary">For example: </span>
          {example.join(" → ")}
        </p>
      )}
    </section>
  )
}
