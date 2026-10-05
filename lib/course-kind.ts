import type { CourseKind } from "@/lib/db/models"

/**
 * The one reader of `Course.kind` (owner meeting 2026-10-03). Client-safe.
 * Legacy rows carry no `kind` and are school programs.
 */
export function courseKindOf(course: { kind?: CourseKind | null }): CourseKind {
  return course.kind ?? "program"
}

/** Mongo filter for school programs — matches legacy rows without a kind. */
export const PROGRAM_KIND_FILTER = { kind: { $nin: ["marketplace", "new-economy"] } } as const

export const COURSE_KIND_LABEL: Record<CourseKind, string> = {
  program: "School program",
  marketplace: "Marketplace course",
  "new-economy": "New Economy (free)",
}
