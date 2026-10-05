/**
 * Pure date maths for the tutor calendar, in the BROWSER's local time zone
 * (every function reads local fields, so call it client-side only). Weeks
 * start on Monday. No dependencies.
 */

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

/** Local midnight of `d`. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** `d` moved by whole calendar days (local), keeping midnight across DST changes. */
export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1)
}

/** Local midnight of the Monday on or before `d`. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d)
  const mondayIndex = (day.getDay() + 6) % 7 // Mon = 0 … Sun = 6
  return addDays(day, -mondayIndex)
}

/** The 42 days (6 Monday-first weeks) a month view shows for `d`'s month. */
export function monthGrid(d: Date): Date[] {
  const first = startOfWeek(startOfMonth(d))
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

/** The 7 days of the week containing `d`. */
export function weekDays(d: Date): Date[] {
  const first = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(first, i))
}

/** Stable local-day key, e.g. "2026-10-05". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}
