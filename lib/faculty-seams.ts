import "server-only"
import type { Types } from "mongoose"
import { Course, type PackageKey } from "@/lib/db/models"
import { cohortsForEnrollments } from "@/lib/cohort-calendar"
import { PROGRAM_KIND_FILTER } from "@/lib/course-kind"
import { masteryInputsForMany } from "@/lib/mastery-inputs"
import { masteryView, type MasteryResult } from "@/lib/mastery-score"

/*
 * The faculty dashboard's two seams (institutional blueprint Phase 19), both
 * filled: cohorts (Phase 12) and Mastery (Phase 16). While a seam returns an
 * empty map, My Students and Student Performance hide every cohort or Mastery
 * column, filter and card.
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
 * Each enrollment's cohort, keyed by enrollment id, through Phase 12's read
 * model (`cohortsForEnrollments`: `purchasedAt`, or an earlier approved ESPEE
 * proof). Only active or completed school-program rows have one (ruling 3).
 */
export async function cohortsFor(rows: SeamEnrollment[]): Promise<Map<string, CohortTag>> {
  const live = rows.filter((r) => r.status === "active" || r.status === "completed")
  if (live.length === 0) return new Map()
  const programs = await Course.find({ _id: { $in: live.map((r) => r.course) }, ...PROGRAM_KIND_FILTER })
    .select("_id")
    .lean()
  const programIds = new Set(programs.map((c) => c._id.toString()))
  const placed = await cohortsForEnrollments(live.filter((r) => programIds.has(r.course.toString())))
  return new Map(
    [...placed].flatMap(([id, c]) => (c ? [[id, { number: c.number, name: c.name }] as [string, CohortTag]] : []))
  )
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
