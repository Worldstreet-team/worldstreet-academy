import { COHORT_TIME_ZONE } from "@/lib/cohort"

/** Pure labels for the faculty earnings ledger. */

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
