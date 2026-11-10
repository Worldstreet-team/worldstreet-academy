/**
 * WMA Partner performance levels — the programme document of 13 Sept 2026,
 * §3 "Partner performance & recognition" (Owen, 2026-11-05: "follow what the
 * document says"). Pure and client-safe.
 *
 * A level is recognition only: it never changes a referral rate (§3's note).
 * It counts SUCCESSFUL referrals — people this partner invited who went on to
 * pay for an enrollment (`referralSummary().paidCount`, the "Enrolled" figure).
 *
 * Ranges (team, 2026-11-05, replacing the document's 1–100 / 100–500 /
 * 1,000+, which overlapped at 100 and left 501–999 unnamed): Academy 1–100,
 * Growth 101–999, Elite 1,000+, "so every partner falls within a defined
 * level". A level is reached at the bottom of its range.
 */

export type PartnerLevelKey = "academy" | "growth" | "elite"

export type PartnerLevel = {
  key: PartnerLevelKey
  name: string
  /** The range as shown to partners. */
  range: string
  /** Successful referrals that reach this level. */
  from: number
  /** What the level brings, from the document. */
  perk: string
}

export const PARTNER_LEVELS: readonly PartnerLevel[] = [
  {
    key: "academy",
    name: "Academy Partner",
    range: "1–100 successful referrals",
    from: 1,
    perk: "Earn the standard referral reward and gain access to Academy partner communications and recognition.",
  },
  {
    key: "growth",
    name: "Growth Partner",
    range: "101–999 successful referrals",
    from: 101,
    perk: "Receive enhanced recognition within the Academy partner network and access to selected partner opportunities.",
  },
  {
    key: "elite",
    name: "Elite Partner",
    range: "1,000+ successful referrals",
    from: 1000,
    perk: "Receive premium recognition and consideration for additional opportunities and rewards approved by the Academy.",
  },
]

/** §3's closing note, verbatim. */
export const PARTNER_LEVEL_NOTE =
  "Performance levels provide recognition and additional opportunities. They do not automatically change the approved 10% / 12% / 15% referral rates unless otherwise authorised by the Academy."

/** The level `successful` referrals have reached; null before the first. */
export function partnerLevelFor(successful: number): PartnerLevel | null {
  let reached: PartnerLevel | null = null
  for (const level of PARTNER_LEVELS) if (successful >= level.from) reached = level
  return reached
}

/** The next level up and how many more successful referrals reach it; null at the top. */
export function nextPartnerLevel(successful: number): { level: PartnerLevel; more: number } | null {
  const next = PARTNER_LEVELS.find((level) => successful < level.from)
  return next ? { level: next, more: next.from - successful } : null
}
