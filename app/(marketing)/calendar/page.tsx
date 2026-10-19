import type { Metadata } from "next"

import { BRAND } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"
import { cohortDateFull } from "@/lib/cohort"
import { getCohortCalendar } from "@/lib/cohort-calendar"
import { COHORT_STATUS_LABEL, cohortStatus, type CohortView } from "@/lib/cohort-rules"
import { CohortBanner } from "@/components/marketing/cohort-banner"
import { SectionLabel } from "@/components/marketing/section-heading"

// Cohorts change in admin; read them per request.
export const revalidate = 0

export const metadata: Metadata = {
  title: "Academic Calendar",
  description: `Cohorts are the academic sessions of ${BRAND.name}. Every cohort, with its dates.`,
  alternates: { canonical: appUrl("/calendar") },
}

function statusOf(c: CohortView, all: CohortView[]) {
  return cohortStatus(c, all, Date.now())
}

/**
 * `/calendar` — the Academic Calendar (blueprint §19/§20): the next cohort
 * as the landing's band, then every cohort, newest start first. A cohort's
 * admin note never prints here.
 */
export default async function CalendarPage() {
  const calendar = await getCohortCalendar()
  const newestFirst = [...calendar.all].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))

  return (
    <div className="pb-24 md:pb-32">
      <section className="mx-auto max-w-7xl px-6 pt-14 md:pt-24">
        <SectionLabel>Academic Calendar</SectionLabel>
        <h1
          className="mt-4 max-w-[22ch] font-display font-semibold leading-[1.04] tracking-[-0.025em] text-ws-primary"
          style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
        >
          Academic Calendar
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ws-muted md:text-[18px]">
          Cohorts are the academic sessions of the Academy.
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-7xl px-6">
        {calendar.next ? (
          <CohortBanner variant="band" cohort={calendar.next} />
        ) : (
          <div className="rounded-[20px] border border-ws-hairline bg-ws-surface p-6 text-[15px] text-ws-muted dark:border-transparent sm:p-8">
            The next cohort&rsquo;s start date will be published here.
          </div>
        )}
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-6">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ws-primary">All cohorts</h2>
        <div className="mt-6 rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent sm:p-8">
          <ol className="divide-y divide-ws-hairline">
            {newestFirst.map((c) => (
              <li
                key={c.number}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[16px] font-semibold text-ws-primary">{c.name}</span>
                  <span className="rounded-full bg-ws-chip px-3 py-1 text-[12px] font-semibold text-ws-primary">
                    {COHORT_STATUS_LABEL[statusOf(c, calendar.all)]}
                  </span>
                </div>
                <p className="text-[14px] text-ws-muted">
                  {`Starts ${cohortDateFull(c.startsAt)}`}
                  {c.endsAt ? ` · Ends ${cohortDateFull(c.endsAt)}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  )
}
