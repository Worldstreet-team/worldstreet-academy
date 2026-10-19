import { COHORT_TIME_ZONE } from "@/lib/cohort"
import type { ResourceKind } from "@/lib/db/models"

/** Pure labels for the faculty pages: the earnings ledger and Course Materials. */

export const EARNING_KIND_LABEL: Record<"sale" | "adjustment" | "referral", string> = {
  sale: "Sale",
  adjustment: "Refund",
  referral: "Partner commission",
}

export const EARNING_STATUS_LABEL: Record<"pending" | "cleared" | "reversed", string> = {
  pending: "Clearing",
  cleared: "In wallet",
  reversed: "Reversed",
}

/** The instructor's share of a sale, as a whole percent. "—" when gross is 0. */
export function earningShareLabel(grossMinor: number, netMinor: number): string {
  if (grossMinor === 0) return "—"
  return `${Math.round((netMinor / grossMinor) * 100)}%`
}

/** "19 Oct 2026", in the Lagos zone. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: COHORT_TIME_ZONE,
  })
}

/** Course Materials: a resource's kind, as the learner's materials list names it. */
export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  pdf: "PDF",
  ebook: "eBook",
  worksheet: "Worksheet",
  template: "Template",
  slides: "Slides",
  link: "Link",
}

/** "820 KB", "4.2 MB"; empty when the size is unknown (links, old rows). */
export function fileSizeLabel(bytes: number): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * An ISO string, or null for a missing or invalid date. Lean reads skip schema
 * defaults and the Go API writes these collections, so a date may be absent;
 * `new Date(undefined).toISOString()` would throw.
 */
export function isoOrNull(value: Date | string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
