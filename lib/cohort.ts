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
 * same way: build-time like the date, falling back to 1. Phase 12 replaces
 * both with data.
 */

const DEFAULT_STARTS_AT = "2026-10-19T00:00:00+01:00"

/** The cohort's home time zone — dates are printed as a Lagos learner reads them. */
export const COHORT_TIME_ZONE = "Africa/Lagos"

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
