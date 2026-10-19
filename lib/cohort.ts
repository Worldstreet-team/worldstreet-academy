/**
 * The next live cohort — the one home for its start (owner meeting,
 * 2026-10-03: "live cohort begins on the 19th", with a countdown every
 * visitor sees). The landing, school and program pages count down to it, and
 * the package cards' discount ends at the same instant ("pay now" prices hold
 * until the cohort begins). Client-safe: no server imports.
 *
 * `NEXT_PUBLIC_COHORT_STARTS_AT` (ISO 8601 with an offset) moves it without a
 * code change; it is inlined at build time, so a new value needs a redeploy.
 * An unparseable value falls back to the default rather than hiding the date.
 * `NEXT_PUBLIC_COHORT_NUMBER` (a whole number, 1 or more) names the cohort the
 * same way: build-time like the date, falling back to 1. Phase 12 moves the
 * date to data (`lib/cohort-calendar.ts`); this module keeps the zone and the
 * date formatters.
 */

const DEFAULT_STARTS_AT = "2026-10-19T00:00:00+01:00"

/** The cohort's home time zone — dates are printed as a Lagos learner reads them. */
export const COHORT_TIME_ZONE = "Africa/Lagos"

/** Africa/Lagos has no daylight saving, so its offset is fixed. */
export const COHORT_UTC_OFFSET = "+01:00"

const dateLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: COHORT_TIME_ZONE,
})
const dateShort = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: COHORT_TIME_ZONE,
})
const dateYear = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: COHORT_TIME_ZONE })

/** "Monday 19 October" */
export function cohortDateLabel(iso: string): string {
  return dateLabel.format(new Date(iso))
}

/** "19 Oct" */
export function cohortDateShort(iso: string): string {
  return dateShort.format(new Date(iso))
}

/** "Monday 19 October 2026" */
export function cohortDateFull(iso: string): string {
  const d = new Date(iso)
  // Composed, because some ICU versions put a comma after the weekday.
  return `${dateLabel.format(d)} ${dateYear.format(d)}`
}

/** An ISO instant as Lagos wall time, `YYYY-MM-DDTHH:mm`. */
export function lagosLocal(iso: string): string {
  return new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 16)
}

/**
 * Reads `YYYY-MM-DDTHH:mm` as Lagos wall time. Null for any other shape and
 * for an impossible date (it fails the round trip through `lagosLocal`).
 */
export function lagosInstant(local: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const d = new Date(`${local}:00${COHORT_UTC_OFFSET}`)
  if (Number.isNaN(d.getTime())) return null
  return lagosLocal(d.toISOString()) === local ? d : null
}

function parseStart(value: string | undefined): Date {
  const parsed = value ? new Date(value) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(DEFAULT_STARTS_AT)
}

const STARTS_AT = parseStart(process.env.NEXT_PUBLIC_COHORT_STARTS_AT)

function parseNumber(value: string | undefined): number {
  const n = value && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}

/** The cohort's number, a whole number of 1 or more. */
export const COHORT_NUMBER = parseNumber(process.env.NEXT_PUBLIC_COHORT_NUMBER)

/** "Cohort 002" — the cohort as copy. */
export const COHORT_NAME = `Cohort ${String(COHORT_NUMBER).padStart(3, "0")}`

/** ISO instant the cohort begins — what countdowns are given. */
export const COHORT_STARTS_AT_ISO = STARTS_AT.toISOString()

/** "Monday 19 October" — the start date as copy. */
export const COHORT_DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: COHORT_TIME_ZONE,
}).format(STARTS_AT)

/** "19 Oct" — the start date where space is short. */
export const COHORT_DATE_SHORT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: COHORT_TIME_ZONE,
}).format(STARTS_AT)

/** True until the cohort begins. Server callers pass nothing; tests can pass a clock. */
export function cohortIsUpcoming(now: number = Date.now()): boolean {
  return STARTS_AT.getTime() > now
}
