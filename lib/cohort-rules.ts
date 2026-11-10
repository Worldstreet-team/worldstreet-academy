/**
 * Cohort rules — pure and client-safe (relative imports only, so a scratch
 * assert script can load it). Cohorts are the Academy's academic sessions
 * (Phase 12, D20). Nothing is stored on `Enrollment`: a learner's cohort is
 * derived on read from the enrolment date. That date is `purchasedAt` (else
 * `createdAt`); for ESPEE, an approved proof submitted earlier than
 * `purchasedAt` counts instead (ruling 2), so a learner who paid before a
 * start but was approved after it stays in that cohort.
 *
 * Every function sorts a copy by `startsAt` (then `number`) and never assumes
 * sorted input.
 *
 * `hidden` (owner, 2026-11-08) is the admin's "Show on the website" switch,
 * off. It changes what the public is told, never who is in a cohort: placement
 * reads every cohort, shown or hidden.
 */

export type CohortView = { number: number; name: string; startsAt: string; endsAt: string | null; hidden: boolean }
export type CohortCalendar = {
  /**
   * The cohort the website announces: the soonest upcoming one, and only while
   * it is shown. A hidden next cohort means no countdown at all; the site never
   * skips ahead to a later shown cohort, because a visitor who pays now is
   * placed in the soonest one, shown or not.
   */
  next: CohortView | null
  /** The soonest upcoming cohort, shown or hidden: staff views only. */
  upcoming: CohortView | null
  current: CohortView | null
  all: CohortView[]
}
export type CohortStatus = "upcoming" | "running" | "past"

export const COHORT_STATUS_LABEL: Record<CohortStatus, string> = {
  upcoming: "Upcoming",
  running: "In session",
  past: "Ended",
}

export const DEFAULT_COHORT_STARTS_AT = "2026-10-19T00:00:00+01:00"

/** "Cohort 002" — the cohort as copy. */
export function cohortName(n: number): string {
  return `Cohort ${String(n).padStart(3, "0")}`
}

function sorted(cohorts: readonly CohortView[]): CohortView[] {
  return [...cohorts].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.number - b.number
  )
}

/** The soonest cohort starting strictly after `now`. */
export function nextCohort(cohorts: readonly CohortView[], now: number): CohortView | null {
  return sorted(cohorts).find((c) => Date.parse(c.startsAt) > now) ?? null
}

/** The latest cohort that started at or before `now`. */
export function currentCohort(cohorts: readonly CohortView[], now: number): CohortView | null {
  const started = sorted(cohorts).filter((c) => Date.parse(c.startsAt) <= now)
  return started.length ? started[started.length - 1] : null
}

/** The first cohort starting at or after the enrolment, else the latest one. */
export function cohortForEnrolment(
  cohorts: readonly CohortView[],
  enrolledAt: Date
): CohortView | null {
  const all = sorted(cohorts)
  if (!all.length) return null
  const at = enrolledAt.getTime()
  return all.find((c) => Date.parse(c.startsAt) >= at) ?? all[all.length - 1]
}

/**
 * Past once its end has passed, or, with no end, once a later cohort has
 * started. Running otherwise, once started. Upcoming before the start.
 */
export function cohortStatus(
  cohort: CohortView,
  cohorts: readonly CohortView[],
  now: number
): CohortStatus {
  const start = Date.parse(cohort.startsAt)
  if (start > now) return "upcoming"
  if (cohort.endsAt) return Date.parse(cohort.endsAt) <= now ? "past" : "running"
  const laterStarted = cohorts.some((c) => {
    const s = Date.parse(c.startsAt)
    return s <= now && (s > start || (s === start && c.number > cohort.number))
  })
  return laterStarted ? "past" : "running"
}

export function calendarOf(cohorts: readonly CohortView[], now: number): CohortCalendar {
  const upcoming = nextCohort(cohorts, now)
  return {
    next: upcoming && !upcoming.hidden ? upcoming : null,
    upcoming,
    current: currentCohort(cohorts, now),
    all: sorted(cohorts),
  }
}

/**
 * The env-built cohort that places learners while the collection is empty
 * (ruling 5). It is hidden: the website announces only a cohort an admin
 * added and left shown, so removing every cohort can never bring back a
 * countdown nobody can switch off.
 */
export function fallbackCohort(startsAt: string | undefined, number: string | undefined): CohortView {
  const parsed = startsAt ? new Date(startsAt) : null
  const start =
    parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(DEFAULT_COHORT_STARTS_AT)
  const trimmed = number?.trim() ?? ""
  const n = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN
  const num = Number.isSafeInteger(n) && n >= 1 ? n : 1
  return { number: num, name: cohortName(num), startsAt: start.toISOString(), endsAt: null, hidden: true }
}

/**
 * The instant an enrolment counts from: `purchasedAt ?? createdAt ?? epoch`,
 * or the approved ESPEE proof's submission time when that is earlier.
 */
export function enrolmentInstant(
  row: { purchasedAt?: Date | null; createdAt?: Date | null },
  espeeSubmittedAt: Date | null
): Date {
  const base = row.purchasedAt ?? row.createdAt ?? new Date(0)
  return espeeSubmittedAt && espeeSubmittedAt.getTime() < base.getTime() ? espeeSubmittedAt : base
}
