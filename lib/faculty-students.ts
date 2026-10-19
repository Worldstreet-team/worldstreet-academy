import type { PackageKey } from "@/lib/db/models"
import { PACKAGE_KEYS, PACKAGE_LABEL, isPackageKey } from "@/lib/entitlements"

/** Pure helpers for the faculty "My Students" list: its filters, links and labels. */

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

/** The list's URL, keeping only the filters that are set. */
export function studentsHref(f: FacultyStudentFilters): string {
  const q = new URLSearchParams()
  if (f.program) q.set("program", f.program)
  if (f.plan) q.set("plan", f.plan)
  if (f.cohort) q.set("cohort", String(f.cohort))
  const s = q.toString()
  return s ? `/instructor/students?${s}` : "/instructor/students"
}

/** A null package is full access (legacy, free or grandfathered). */
export function planOf(packageKey: PackageKey | null | undefined): { key: PlanFilter; label: string } {
  return packageKey ? { key: packageKey, label: PACKAGE_LABEL[packageKey] } : { key: "full", label: "Full access" }
}

export function assignmentsLabel(graded: number, average: number | null): string {
  return graded === 0 || average === null ? "None graded" : `${graded} graded · avg ${average}`
}
