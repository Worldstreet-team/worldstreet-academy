/**
 * The Academy's cohort zone and date formatters. The cohort itself is data
 * (`lib/cohort-calendar.ts`, D20): an admin enters it at `/admin/cohorts` and
 * every countdown follows it. `NEXT_PUBLIC_COHORT_STARTS_AT` and
 * `NEXT_PUBLIC_COHORT_NUMBER` are read there too, only as the fallback while
 * the collection is empty. Client-safe: no server imports.
 */

/** The cohort's home time zone — dates are printed as a Lagos learner reads them. */
export const COHORT_TIME_ZONE = "Africa/Lagos"

/** Africa/Lagos has no daylight saving, so its offset is fixed. */
export const COHORT_UTC_OFFSET = "+01:00"

const dateParts = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: COHORT_TIME_ZONE,
})
const dateShort = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "numeric",
  timeZone: COHORT_TIME_ZONE,
})

/** Weekday, day, month and year as Lagos reads them, picked out of the parts so no ICU's punctuation leaks in. */
function lagosDateParts(iso: string): { weekday: string; day: string; month: string; year: string } {
  const out = { weekday: "", day: "", month: "", year: "" }
  for (const p of dateParts.formatToParts(new Date(iso))) {
    if (p.type === "weekday" || p.type === "day" || p.type === "month" || p.type === "year") out[p.type] = p.value
  }
  return out
}

/** "Monday 19 October" — the same on every ICU (no comma after the weekday). */
export function cohortDateLabel(iso: string): string {
  const { weekday, day, month } = lagosDateParts(iso)
  return `${weekday} ${day} ${month}`
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * Short weekday, day and a fixed three-letter month (newer ICU prints "Sept"),
 * picked out of the parts. The weekday comes from the Lagos wall date and a
 * pinned table, so no ICU or locale names it.
 */
export function cohortShortParts(iso: string): { weekday: string; day: string; month: string } {
  const out = { weekday: "", day: "", month: "" }
  out.weekday = WEEKDAYS_SHORT[new Date(`${lagosLocal(iso).slice(0, 10)}T00:00:00Z`).getUTCDay()] ?? ""
  for (const p of dateShort.formatToParts(new Date(iso))) {
    if (p.type === "day") out.day = p.value
    else if (p.type === "month") out.month = MONTHS_SHORT[Number(p.value) - 1] ?? p.value
  }
  return out
}

/** "19 Oct" — "16 Sep" on every ICU. */
export function cohortDateShort(iso: string): string {
  const { day, month } = cohortShortParts(iso)
  return `${day} ${month}`
}

/** "Monday 19 October 2026" */
export function cohortDateFull(iso: string): string {
  return `${cohortDateLabel(iso)} ${lagosDateParts(iso).year}`
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
