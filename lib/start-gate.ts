import { isSchoolSlug } from "@/lib/schools"

/** First-party memory of a guest's landing-page choice (30 days). */
export const START_SCHOOL_COOKIE = "wsa_school"

export type StartGateInput = {
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  instructorStatus: "none" | "applied" | "interview" | "approved" | "rejected"
  /** An active or completed enrollment — the only thing that opens the dashboard. */
  hasAccess: boolean
  pathname: string
}

/**
 * Reachable without paying: the retired picker URL (now a redirect), the
 * till, the wallet (so a learner can top up to pay), the instructor door,
 * invite links, and referrals (owner, 2026-10-05: anyone signed in can share
 * their code).
 */
const EXEMPT_PREFIXES = [
  "/dashboard/start",
  "/dashboard/checkout",
  "/dashboard/wallet",
  "/dashboard/become-instructor",
  "/dashboard/meetings",
  "/dashboard/referrals",
] as const

/**
 * No dashboard without paying (owner meeting, 2026-10-03): a learner gets in
 * only with an active or completed enrollment. A saved school
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
 * The all-schools target carries `?start=1` so `/schools` can say why the
 * learner is there ("choose a program to get started"). The page shows that
 * notice only to a signed-in learner the gate would still send, so an
 * enrolled learner following an old `/dashboard/start` link never sees it.
 */
export function schoolsPathFor(school: string | null | undefined): string {
  return isSchoolSlug(school) ? `/schools/${school}` : "/schools?start=1"
}
