import { isSchoolSlug, type SchoolSlug } from "@/lib/schools"

/** First-party memory of a guest's landing-page choice (30 days). */
export const START_SCHOOL_COOKIE = "wsa_school"

export type StartGateInput = {
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  instructorStatus: "none" | "applied" | "interview" | "approved" | "rejected"
  hasEnrollment: boolean
  hasIntent: boolean
  pathname: string
}

/** Reachable without a school: the picker, the till, the instructor door, and invite links. */
const EXEMPT_PREFIXES = [
  "/dashboard/start",
  "/dashboard/checkout",
  "/dashboard/become-instructor",
  "/dashboard/meetings",
] as const

/**
 * School first (owner, 2026-09-16): a learner with no enrollment and no saved
 * school chooses one before the dashboard opens. Instructors, admins,
 * applicants and anyone who already has either are never asked.
 */
export function needsSchoolChoice(input: StartGateInput): boolean {
  if (input.role !== "USER") return false
  if (input.instructorStatus !== "none") return false
  if (input.hasEnrollment || input.hasIntent) return false
  return !EXEMPT_PREFIXES.some((p) => input.pathname === p || input.pathname.startsWith(`${p}/`))
}

export type StartStep =
  | { step: "school" }
  | { step: "program"; school: SchoolSlug }
  | { step: "package"; school: SchoolSlug; courseId: string }
  | { step: "waitlist"; school: SchoolSlug }

/**
 * Which screen `/dashboard/start` shows. A school with one program skips the
 * program step — for it, choosing the school IS choosing the program.
 */
export function resolveStartStep(args: {
  school: string | null | undefined
  program: string | null | undefined
  /** Published program ids in that school. */
  programIds: readonly string[]
}): StartStep {
  if (!isSchoolSlug(args.school)) return { step: "school" }
  const school = args.school
  if (args.programIds.length === 0) return { step: "waitlist", school }
  if (args.program && args.programIds.includes(args.program)) {
    return { step: "package", school, courseId: args.program }
  }
  if (args.programIds.length === 1) return { step: "package", school, courseId: args.programIds[0] }
  return { step: "program", school }
}
