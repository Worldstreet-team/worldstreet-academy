import type { EnrollmentStatus, PackageKey } from "@/lib/db/models"
import { PACKAGE_KEYS, PACKAGE_LABEL, isPackageKey } from "@/lib/entitlements"

/** Pure helpers for the faculty "My Students" list (its filters, links and labels) and Student Performance. */

export type PlanFilter = PackageKey | "full"

export const PLAN_FILTERS: readonly { value: PlanFilter; label: string }[] = [
  ...PACKAGE_KEYS.map((key) => ({ value: key as PlanFilter, label: PACKAGE_LABEL[key] })),
  { value: "full", label: "Full access" },
]

export type FacultyStudentFilters = { program: string | null; plan: PlanFilter | null; cohort: number | null }

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

/** Anything the URL (or a caller) sends becomes a valid filter set; bad values are dropped. */
export function parseStudentFilters(raw: Record<string, string | string[] | undefined>): FacultyStudentFilters {
  const program = first(raw.program)
  const plan = first(raw.plan)
  const cohort = first(raw.cohort)
  const cohortNumber = cohort !== undefined && /^\d+$/.test(cohort) ? Number(cohort) : null
  return {
    program: program && /^[a-f0-9]{24}$/.test(program) ? program : null,
    plan: plan === "full" || isPackageKey(plan) ? plan : null,
    cohort: cohortNumber !== null && cohortNumber >= 1 ? cohortNumber : null,
  }
}

/** The faculty pages that share these filters: My Students and Student Performance. */
export type StudentsBase = "/instructor/students" | "/instructor/performance"

/** The list's URL, keeping only the filters that are set. */
export function studentsHref(f: FacultyStudentFilters, base: StudentsBase = "/instructor/students"): string {
  const q = new URLSearchParams()
  if (f.program) q.set("program", f.program)
  if (f.plan) q.set("plan", f.plan)
  if (f.cohort) q.set("cohort", String(f.cohort))
  const s = q.toString()
  return s ? `${base}?${s}` : base
}

/** A null package is full access (legacy, free or grandfathered). */
export function planOf(packageKey: PackageKey | null | undefined): { key: PlanFilter; label: string } {
  return packageKey ? { key: packageKey, label: PACKAGE_LABEL[packageKey] } : { key: "full", label: "Full access" }
}

export function assignmentsLabel(graded: number, average: number | null): string {
  return graded === 0 || average === null ? "None graded" : `${graded} graded · avg ${average}`
}

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  active: "Active",
  completed: "Completed",
  pre_enrolled: "Pre-enrolled",
  expired: "Expired",
  refunded: "Refunded",
  suspended: "Suspended",
  cancelled: "Cancelled",
}

/* ── Student Performance (institutional blueprint §16) ───────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * When an active learner "needs attention": any one of these. Low progress
 * counts only once the learner has had `progressAfterDays` to make some, so a
 * new enrolment isn't flagged on day one. Completed learners never are.
 */
export const NEEDS_ATTENTION = { inactiveDays: 14, progressBelow: 25, progressAfterDays: 14 } as const

export type AttentionReason = "inactive" | "low_progress" | "failed_exam"

export const ATTENTION_LABEL: Record<AttentionReason, string> = {
  inactive: `No activity in ${NEEDS_ATTENTION.inactiveDays} days`,
  low_progress: `Under ${NEEDS_ATTENTION.progressBelow}% progress`,
  failed_exam: "Best exam not passed",
}

/** The rule in one sentence, for the section's subtitle. */
export const NEEDS_ATTENTION_RULE = `No activity in ${NEEDS_ATTENTION.inactiveDays} days, under ${NEEDS_ATTENTION.progressBelow}% progress after ${NEEDS_ATTENTION.progressAfterDays} days, or a best exam not passed.`

/** The row fields the ranking and the summaries read (a `FacultyStudentRow` has them all). */
export type PerformanceRow = {
  program: { id: string; title: string }
  status: "active" | "completed"
  progress: number
  enrolledAt: string
  lastActiveAt: string | null
  bestExam: { percent: number; passed: boolean } | null
  attendance: number | null
  mastery: number | null
}

export function attentionReasons(r: PerformanceRow, nowMs: number): AttentionReason[] {
  if (r.status === "completed") return []
  const reasons: AttentionReason[] = []
  const enrolled = Date.parse(r.enrolledAt)
  const lastSeen = r.lastActiveAt ? Date.parse(r.lastActiveAt) : enrolled
  if (nowMs - lastSeen > NEEDS_ATTENTION.inactiveDays * DAY_MS) reasons.push("inactive")
  if (r.progress < NEEDS_ATTENTION.progressBelow && nowMs - enrolled > NEEDS_ATTENTION.progressAfterDays * DAY_MS) {
    reasons.push("low_progress")
  }
  if (r.bestExam && !r.bestExam.passed) reasons.push("failed_exam")
  return reasons
}

/**
 * Needs attention first (most reasons, then least progress), then everyone
 * else by Mastery Score once Mastery is live (no score last), else by progress.
 */
export function rankForAttention<T extends PerformanceRow>(
  rows: T[],
  nowMs: number,
  masteryReady: boolean
): { attention: (T & { reasons: AttentionReason[] })[]; rest: T[] } {
  const attention: (T & { reasons: AttentionReason[] })[] = []
  const rest: T[] = []
  for (const r of rows) {
    const reasons = attentionReasons(r, nowMs)
    if (reasons.length > 0) attention.push({ ...r, reasons })
    else rest.push(r)
  }
  attention.sort((a, b) => b.reasons.length - a.reasons.length || a.progress - b.progress)
  const score = (r: T) => r.mastery ?? -1
  rest.sort((a, b) => (masteryReady ? score(b) - score(a) : 0) || b.progress - a.progress)
  return { attention, rest }
}

export type ProgramSummary = {
  id: string
  title: string
  learners: number
  avgProgress: number
  /** Null until any learner in the program has one. */
  avgMastery: number | null
  /** Of the learners who sat the exam; null when none has. */
  examPassRate: number | null
  examTakers: number
  avgAttendance: number | null
}

const mean = (values: (number | null)[]): number | null => {
  const xs = values.filter((v): v is number => v !== null)
  return xs.length === 0 ? null : Math.round(xs.reduce((s, v) => s + v, 0) / xs.length)
}

/** One summary per program, in title order. */
export function programSummaries(rows: PerformanceRow[]): ProgramSummary[] {
  const groups = new Map<string, PerformanceRow[]>()
  for (const r of rows) groups.set(r.program.id, [...(groups.get(r.program.id) ?? []), r])
  return [...groups.values()]
    .map((g) => {
      const takers = g.filter((r) => r.bestExam !== null)
      return {
        id: g[0].program.id,
        title: g[0].program.title,
        learners: g.length,
        avgProgress: mean(g.map((r) => r.progress)) ?? 0,
        avgMastery: mean(g.map((r) => r.mastery)),
        examPassRate: takers.length ? Math.round((takers.filter((r) => r.bestExam?.passed).length / takers.length) * 100) : null,
        examTakers: takers.length,
        avgAttendance: mean(g.map((r) => r.attendance)),
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}
