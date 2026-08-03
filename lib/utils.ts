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
