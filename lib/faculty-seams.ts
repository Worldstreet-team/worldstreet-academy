import "server-only"
import type { Types } from "mongoose"
import { Course, type PackageKey } from "@/lib/db/models"
import { masteryInputsForMany } from "@/lib/mastery-inputs"
import { masteryView, type MasteryResult } from "@/lib/mastery-score"

/*
 * The faculty dashboard's two seams (institutional blueprint Phase 19). The
 * Phase 16 seam (Mastery) is filled; the Phase 12 seam (cohorts) is one line
 * marked SEAM, which whoever merges Phase 12 replaces with the fill below it.
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

export type { MasteryResult }

/**
 * Each enrollment's cohort, keyed by enrollment id.
 * Phase 12 fill (lib/cohort-calendar.ts + lib/cohort-rules.ts; pass the enrolment date Phase 12's read model passes):
 *   const { all } = await getCohortCalendar(); return new Map(rows.flatMap((r) => { const c = cohortForEnrolment(all, r.activatedAt ?? r.purchasedAt); return c ? [[r._id.toString(), { number: c.number, name: c.name }] as [string, CohortTag]] : [] }))
 */
export async function cohortsFor(rows: SeamEnrollment[]): Promise<Map<string, CohortTag>> {
  void rows // delete with the fill
  return new Map() // SEAM(phase-12)
}

/** Each enrollment's Mastery Score and parts (parts the plan excludes are nulled), keyed by enrollment id. */
export async function masteryFor(rows: SeamEnrollment[]): Promise<Map<string, MasteryResult>> {
  if (rows.length === 0) return new Map()
  const courses = await Course.find({ _id: { $in: [...new Set(rows.map((r) => r.course.toString()))] } })
    .select("packages")
    .lean()
  const byId = new Map(courses.map((c) => [c._id.toString(), c]))
  const pairs = rows.flatMap((enrollment) => {
    const course = byId.get(enrollment.course.toString())
    return course ? [{ enrollment, course }] : []
  })
  const facts = await masteryInputsForMany(pairs)
  return new Map([...facts].map(([id, f]) => [id, masteryView(f).result]))
}
