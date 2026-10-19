import Link from "next/link"

import { cohortDateLabel } from "@/lib/cohort"
import type { CohortView } from "@/lib/cohort-rules"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { Eyebrow } from "@/components/ui/system"
import { CohortCountdown, WhileCohortUpcoming } from "@/components/shared/cohort-countdown"
import type { SchoolProgram } from "@/components/schools/model"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"

export type SchoolCohortRow = { slug: string; title: string; plans: string[] }

/**
 * The school's open programs (not coming soon) that carry live classes, with
 * the plans that include them. A ladder-less program names its one plan.
 */
export function schoolCohortRows(programs: SchoolProgram[]): SchoolCohortRow[] {
  return programs.flatMap(({ program, comingSoon }) => {
    if (comingSoon) return []
    const plans = program.packages
      .filter((pkg) => pkg.entitlements.liveClasses)
      .map((pkg) => (program.tierCount > 0 ? PACKAGE_LABEL[pkg.key] : pkg.name))
    return plans.length > 0 ? [{ slug: program.slug, title: program.title, plans }] : []
  })
}

/**
 * `#cohorts` — the next cohort and which plans of this school's programs
 * include live classes. Hidden when there is no next cohort or no such program.
 */
export function SchoolCohorts({ cohort, rows }: { cohort: CohortView | null; rows: SchoolCohortRow[] }) {
  if (!cohort || rows.length === 0) return null
  return (
    <WhileCohortUpcoming startsAt={cohort.startsAt}>
      <section id="cohorts" aria-labelledby="cohorts-heading" className={SCHOOL_SECTION}>
        <SectionHead
          id="cohorts-heading"
          title="Upcoming cohorts"
          lede={`${cohort.name} starts ${cohortDateLabel(cohort.startsAt)}.`}
          aside={<CohortCountdown startsAt={cohort.startsAt} variant="compact" prefix="Starts in " />}
        />
        <div className="mt-10 rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent sm:p-8">
          <Eyebrow>Plans with live classes</Eyebrow>
          <ul className="mt-4 divide-y divide-ws-hairline">
            {rows.map((row) => (
              <li
                key={row.slug}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0"
              >
                <Link href={`/programs/${row.slug}#packages`} className="text-[15px] font-semibold text-ws-primary hover:underline">
                  {row.title}
                </Link>
                <span className="text-[14px] text-ws-muted">{row.plans.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </WhileCohortUpcoming>
  )
}
