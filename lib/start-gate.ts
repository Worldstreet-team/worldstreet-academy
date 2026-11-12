import { ON_SALE_FILTER } from "@/lib/entitlements"
import { schoolSlugOf } from "@/lib/schools"

/**
 * The courses whose enrollment opens the dashboard (owner voice note,
 * 2026-11-02: "the official academy, where they pay to have access to the
 * dashboard"): an Academy course — a school program or New Economy course —
 * on sale. A marketplace (tutor) course or a legacy free course never opens
 * it; its page still opens for a learner who also has an Academy enrollment.
 * Legacy rows without a kind are programs, so `$ne` matches them.
 */
export const OPENS_DASHBOARD_FILTER = { ...ON_SALE_FILTER, kind: { $ne: "marketplace" } } as const

/** First-party memory of a guest's landing-page choice (30 days). */
export const START_SCHOOL_COOKIE = "wsa_school"

export type StartGateInput = {
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  instructorStatus: "none" | "applied" | "interview" | "approved" | "rejected"
  /** An active or completed enrollment in an Academy course on sale (OPENS_DASHBOARD_FILTER) — the only thing that opens the dashboard. */
  hasAccess: boolean
  pathname: string
}

/**
 * Reachable without paying: the retired picker URL (now a redirect), the
 * till (no longer the wallet: learners add money on the WorldStreet dashboard
 * since 2026-11-12), their payments (a
 * failed or in-review purchase stays visible — corrections brief,
 * 2026-10-28), the instructor door, invite links, referrals (owner,
 * 2026-10-05: anyone signed in can share their code) and the seller
 * application (a marketplace seller needn't be enrolled anywhere — owner,
 * 2026-10-05).
 */
const EXEMPT_PREFIXES = [
  "/dashboard/start",
  "/dashboard/checkout",
  // Closed to learners who haven't paid (Owen, 2026-11-12): checkout now sends them to the WorldStreet dashboard
  // to add money, so the Academy's wallet pages no longer need to be open to them. Kept commented:
  // "/dashboard/wallet",
  "/dashboard/payments",
  "/dashboard/become-instructor",
  "/dashboard/meetings",
  "/dashboard/referrals",
  "/dashboard/sell",
] as const

/**
 * No dashboard without paying (owner meeting, 2026-10-03): a learner gets in
 * only with an active or completed enrollment in an Academy course on sale
 * (OPENS_DASHBOARD_FILTER, 2026-11-02). A saved school
 * (EnrollmentIntent) or a reservation no longer opens it — intents are still
 * saved, for the pay-later reminders. Before that (owner, 2026-09-16; plan
 * D15) any enrollment or saved school was enough. Instructors, admins and
 * applicants are never sent.
 */
export function needsSchoolChoice(input: StartGateInput): boolean {
  if (input.role !== "USER") return false
  if (input.instructorStatus !== "none") return false
  if (input.hasAccess) return false
  return !EXEMPT_PREFIXES.some((p) => input.pathname === p || input.pathname.startsWith(`${p}/`))
}

/**
 * Where the gate (and the retired `/dashboard/start`) sends a learner: the
 * school they named — by URL or the `wsa_school` cookie — else every school.
 * Always a public marketing page, so it can never bounce back into the gate.
 *
 * The `wsa_school` cookie outlives a school rename by 30 days, so a retired slug
 * resolves to its new school here.
 *
 * Both targets carry `?start=1` so the page can say why the learner is there
 * ("Next, choose your program" — GateNotice; a school's page too since
 * 2026-11-11, which before then said nothing). The page shows that notice
 * only to a signed-in learner the gate would still send, so an enrolled
 * learner following an old `/dashboard/start` link never sees it.
 */
export function schoolsPathFor(school: string | null | undefined): string {
  const slug = schoolSlugOf(school)
  return slug ? `/schools/${slug}?start=1` : "/schools?start=1"
}
