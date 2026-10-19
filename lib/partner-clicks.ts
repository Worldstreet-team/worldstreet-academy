/**
 * WMA Partners click rules (institutional blueprint §15, decision D28) — pure
 * and client-safe. A partner link is any marketing page with `?ref=<CODE>`;
 * a visit is counted once per visitor per code per Lagos day, into one
 * `partnerclicks` row per code per day (lib/db/models/partner-click.ts).
 *
 * The visitor is remembered in the `wsa_ref_seen` cookie, whose value is
 * `<day>~<CODE>.<CODE>…`. `~` and `.` are valid cookie characters and never
 * appear in a code.
 */
import { normalizeReferralCode } from "@/lib/referral-link"

export const PARTNER_SEEN_COOKIE = "wsa_ref_seen"
export const PARTNER_TIME_ZONE = "Africa/Lagos"
/** Most codes one visitor's cookie remembers for a day. */
export const PARTNER_SEEN_MAX = 20
export const PARTNER_CLICK_WINDOW_DAYS = 30

export type PartnerClickDay = { day: string; count: number }

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: PARTNER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** The Lagos calendar day of `at`, as "YYYY-MM-DD". */
export function partnerDay(at: Date): string {
  const parts = dayFormat.formatToParts(at)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

/** `n` day keys, newest first, `today` included. */
export function recentDays(today: string, n: number): string[] {
  const [y, m, d] = today.split("-").map(Number)
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10))
}

const BOT_UA =
  /bot\b|crawl|spider|slurp|headless|lighthouse|phantomjs|inspectiontool|mediapartners|facebookexternalhit|preview/i

/** True for a missing or blank user agent, and for known crawlers and previewers. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  const value = (ua ?? "").trim()
  return value === "" || BOT_UA.test(value)
}

/** The codes already counted for this visitor on `day` (empty when the cookie is from another day). */
export function seenCodes(value: string | null | undefined, day: string): string[] {
  const [storedDay, list = ""] = (value ?? "").split("~")
  if (storedDay !== day) return []
  return list
    .split(".")
    .map((c) => normalizeReferralCode(c))
    .filter((c): c is string => c !== null)
}

/** The cookie value after counting `code` on `day`, keeping the last PARTNER_SEEN_MAX codes. */
export function withSeenCode(value: string | null | undefined, day: string, code: string): string {
  const codes = seenCodes(value, day).filter((c) => c !== code)
  codes.push(code)
  return `${day}~${codes.slice(-PARTNER_SEEN_MAX).join(".")}`
}
