import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Social-style count abbreviation per the DS numeric rules (02-typography):
 * counts >= 10,000 abbreviate to one decimal ("12.4K", "1.2M"); smaller
 * counts keep locale separators. Never use for wallet balances.
 */
export function abbreviateCount(n: number): string {
  if (n >= 1_000_000) return `${(Math.floor(n / 100_000) / 10).toLocaleString("en-US")}M`
  if (n >= 10_000) return `${(Math.floor(n / 100) / 10).toLocaleString("en-US")}K`
  return n.toLocaleString("en-US")
}

/**
 * A moment as the browser's local `YYYY-MM-DDTHH:mm`, the value a
 * `<input type="datetime-local">` reads as local time. `toISOString()` gives
 * UTC wall time instead, which put an interview picker's earliest time an hour
 * in the past in Lagos (live QA, 2026-11-12). Browser-only: it uses the
 * viewer's time zone.
 */
export function datetimeLocalValue(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}
