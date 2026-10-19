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
 * When an active learner "needs attention": any one of these. Days count from
 * the later of enrolment and the learner's cohort start, so a learner waiting
 * for their cohort isn't flagged, and low progress counts only once the
 * learner has had `progressAfterDays` to make some. Completed learners never
 * are. Student Performance leaves file products (templates, guides) out: they
 * have no lessons or activity to measure.
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
  /** Null when the row carries no usable date. */
  enrolledAt: string | null
  lastActiveAt: string | null
  /** The learner's cohort, when they have one; its start delays the clock. */
  cohort: { startsAt?: string | null } | null
  bestExam: { percent: number; passed: boolean } | null
  attendance: number | null
  mastery: number | null
}

/** The latest valid instant among these ISO strings; null when none is valid. */
function latest(...values: (string | number | null | undefined)[]): number | null {
  const times = values
    .map((v) => (typeof v === "number" ? v : v ? Date.parse(v) : NaN))
    .filter((t) => !Number.isNaN(t))
  return times.length ? Math.max(...times) : null
}

export function attentionReasons(r: PerformanceRow, nowMs: number): AttentionReason[] {
  if (r.status === "completed") return []
  const reasons: AttentionReason[] = []
  // A row with no usable date skips the time-based checks rather than guessing.
  const from = latest(r.enrolledAt, r.cohort?.startsAt)
  const lastSeen = latest(from, r.lastActiveAt)
  if (lastSeen !== null && nowMs - lastSeen > NEEDS_ATTENTION.inactiveDays * DAY_MS) reasons.push("inactive")
  if (
    from !== null &&
    r.progress < NEEDS_ATTENTION.progressBelow &&
    nowMs - from > NEEDS_ATTENTION.progressAfterDays * DAY_MS
  ) {
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

/**
 * Student Performance's whole view: summaries and the ranking over every row,
 * and only then the cap, on what is rendered (needs-attention first). Capping
 * first would cut exactly the inactive learners, who sort last by activity.
 */
export function performanceOverview<T extends PerformanceRow>(
  rows: T[],
  nowMs: number,
  masteryReady: boolean,
  maxRows: number
): {
  summaries: ProgramSummary[]
  attention: (T & { reasons: AttentionReason[] })[]
  rest: T[]
  attentionTotal: number
  total: number
  truncated: boolean
} {
  const { attention, rest } = rankForAttention(rows, nowMs, masteryReady)
  const shownAttention = attention.slice(0, maxRows)
  return {
    summaries: programSummaries(rows),
    attention: shownAttention,
    rest: rest.slice(0, Math.max(0, maxRows - shownAttention.length)),
    attentionTotal: attention.length,
    total: rows.length,
    truncated: rows.length > maxRows,
  }
}
