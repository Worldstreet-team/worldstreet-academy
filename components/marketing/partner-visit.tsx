"use client"

import { useEffect } from "react"
import { recordPartnerVisit } from "@/lib/actions/partners"
import { REFERRAL_PARAM, normalizeReferralCode } from "@/lib/referral-link"

/** Codes already reported from this tab, so client navigations don't repeat. */
const reported = new Set<string>()

/**
 * Counts a `?ref=` partner-link visit (WMA Partners, D28). It reads
 * `window.location.search` in an effect rather than `useSearchParams`, which
 * would need a Suspense boundary on the statically rendered marketing pages
 * (Phase 18 ruling 2). The server action dedupes per visitor per day.
 */
export function PartnerVisit(): null {
  useEffect(() => {
    const code = normalizeReferralCode(new URLSearchParams(window.location.search).get(REFERRAL_PARAM))
    if (!code || reported.has(code)) return
    reported.add(code)
    recordPartnerVisit(code).catch(() => {})
  }, [])
  return null
}
