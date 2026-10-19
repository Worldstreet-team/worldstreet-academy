import "server-only"
import type { Types } from "mongoose"
import type { PackageKey } from "@/lib/db/models"

/*
 * The faculty dashboard's two seams (institutional blueprint Phase 19). Each
 * body is ONE line marked SEAM; whoever merges Phase 12 or Phase 16 into a tree
 * that has this file replaces that line with the fill below it, plus imports.
 * While a seam returns an empty map, My Students and Student Performance hide
 * every cohort or Mastery column, filter and card.
 */

/** The enrollment fields both seams receive (lean rows). */
export type SeamEnrollment = {
  _id: Types.ObjectId
  user: Types.ObjectId
  course: Types.ObjectId
  status: string
  packageKey?: PackageKey | null
  progress: number
  bestScorePercent?: number | null
  examPassed?: boolean
  purchasedAt: Date
  activatedAt?: Date | null
  createdAt: Date
}

export type CohortTag = { number: number; name: string }

export type MasteryPartKey = "completion" | "assessment" | "assignments" | "projects" | "attendance"
/** Phase 16's masteryScore() result. `weight` is a whole-number percentage (MASTERY_WEIGHTS sums to 100). */
export type MasteryResult = { score: number | null; parts: { key: MasteryPartKey; value: number | null; weight: number }[] }

/**
 * Each enrollment's cohort, keyed by enrollment id.
 * Phase 12 fill (lib/cohort-calendar.ts + lib/cohort-rules.ts; pass the enrolment date Phase 12's read model passes):
 *   const { all } = await getCohortCalendar(); return new Map(rows.flatMap((r) => { const c = cohortForEnrolment(all, r.activatedAt ?? r.purchasedAt); return c ? [[r._id.toString(), { number: c.number, name: c.name }] as [string, CohortTag]] : [] }))
 */
export async function cohortsFor(rows: SeamEnrollment[]): Promise<Map<string, CohortTag>> {
  void rows // delete with the fill
  return new Map() // SEAM(phase-12)
}

/**
 * Each enrollment's Mastery Score and parts, keyed by enrollment id.
 * Phase 16 fill (lib/mastery-inputs.ts + lib/mastery-score.ts; masteryInputsForMany keyed by enrollment id):
 *   return new Map([...(await masteryInputsForMany(rows))].map(([id, inputs]) => [id, masteryScore(inputs)]))
 */
export async function masteryFor(rows: SeamEnrollment[]): Promise<Map<string, MasteryResult>> {
  void rows // delete with the fill
  return new Map() // SEAM(phase-16)
}
