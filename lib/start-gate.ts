import { isSchoolSlug } from "@/lib/schools"

/** First-party memory of a guest's landing-page choice (30 days). */
export const START_SCHOOL_COOKIE = "wsa_school"

export type StartGateInput = {
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  instructorStatus: "none" | "applied" | "interview" | "approved" | "rejected"
  hasEnrollment: boolean
  hasIntent: boolean
  pathname: string
}

/**
 * Reachable without a school: the retired picker URL (now a redirect), the
 * till, the instructor door, and invite links.
 */
const EXEMPT_PREFIXES = [
  "/dashboard/start",
  "/dashboard/checkout",
  "/dashboard/become-instructor",
  "/dashboard/meetings",
] as const

/**
 * School first (owner, 2026-09-16; plan D15, 2026-09-18): a learner with no
 * enrollment and no saved school is sent to the schools before the dashboard
 * opens. Instructors, admins, applicants and anyone who already has either
 * are never sent.
 */
export function needsSchoolChoice(input: StartGateInput): boolean {
  if (input.role !== "USER") return false
  if (input.instructorStatus !== "none") return false
  if (input.hasEnrollment || input.hasIntent) return false
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
