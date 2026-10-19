"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import type { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Cohort, Course, Enrollment } from "@/lib/db/models"
import { requireAdmin } from "@/lib/auth/admin"
import { PROGRAM_KIND_FILTER } from "@/lib/course-kind"
import { cohortDateFull, lagosInstant } from "@/lib/cohort"
import {
  cohortName,
  cohortStatus,
  fallbackCohort,
  type CohortStatus,
  type CohortView,
} from "@/lib/cohort-rules"
import { cohortsForEnrollments } from "@/lib/cohort-calendar"

/**
 * Cohorts, admin side (Phase 12, D20). Times arrive as Lagos wall time
 * (`YYYY-MM-DDTHH:mm`) and are read with the fixed +01:00 offset here, never
 * in the browser. Rules: numbers 1–999 and unique; a higher number starts
 * strictly later than every lower one; a started cohort keeps its number and
 * can't move its start into the future; there is no delete.
 */

export type AdminCohortRow = {
  id: string
  number: number
  name: string
  startsAt: string
  endsAt: string | null
  note: string | null
  status: CohortStatus
  learners: number
}

export type CohortFormInput = {
  number: number
  startsAt: string
  endsAt: string | null
  note: string | null
}

type Result<T> = { success: true; data: T } | { success: false; error: string }

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const CohortInput = z.object({
  number: z.number().int().min(1).max(999),
  startsAt: z.string().regex(LOCAL),
  endsAt: z.string().regex(LOCAL).nullable(),
  note: z.string().trim().max(500).nullable(),
})

const CohortId = z.string().regex(/^[a-f0-9]{24}$/)

type CohortLean = { _id: Types.ObjectId; number: number; startsAt: Date; endsAt: Date | null; note: string | null }

function viewOf(c: { number: number; startsAt: Date; endsAt: Date | null }): CohortView {
  return {
    number: c.number,
    name: cohortName(c.number),
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt ? c.endsAt.toISOString() : null,
  }
}

export async function adminListCohorts(): Promise<
  Result<{ cohorts: AdminCohortRow[]; fallback: CohortView | null }>
> {
  try {
    await connectDB()
    await requireAdmin()

    const rows = (await Cohort.find().sort({ number: -1 }).lean()) as unknown as CohortLean[]
    if (rows.length === 0) {
      return {
        success: true,
        data: {
          cohorts: [],
          fallback: fallbackCohort(
            process.env.NEXT_PUBLIC_COHORT_STARTS_AT,
            process.env.NEXT_PUBLIC_COHORT_NUMBER
          ),
        },
      }
    }

    // Learner count (ruling 13): distinct users with an active or completed
    // program enrolment placed in the cohort.
    const programIds = await Course.distinct("_id", PROGRAM_KIND_FILTER)
    const enrolments = await Enrollment.find({
      course: { $in: programIds },
      status: { $in: ["active", "completed"] },
    })
      .select("_id user purchasedAt createdAt")
      .lean()
    const placed = await cohortsForEnrollments(enrolments)
    const usersByCohort = new Map<number, Set<string>>()
    for (const e of enrolments) {
      const cohort = placed.get(String(e._id))
      if (!cohort) continue
      const set = usersByCohort.get(cohort.number) ?? new Set<string>()
      set.add(String(e.user))
      usersByCohort.set(cohort.number, set)
    }

    const views = rows.map(viewOf)
    const now = Date.now()
    return {
      success: true,
      data: {
        fallback: null,
        cohorts: rows.map((r, i) => ({
          id: String(r._id),
          ...views[i],
          note: r.note ?? null,
          status: cohortStatus(views[i], views, now),
          learners: usersByCohort.get(r.number)?.size ?? 0,
        })),
      },
    }
  } catch (err) {
    console.error("[Cohorts] list failed:", err)
    return { success: false, error: "Couldn't load the cohorts" }
  }
}

/** Shared by create and update: validate, apply the rules, write. */
async function save(id: string | null, input: CohortFormInput): Promise<Result<CohortView>> {
  try {
    await connectDB()
    const admin = await requireAdmin()

    const parsed = CohortInput.safeParse(input)
    if (!parsed.success) return { success: false, error: "Check the number, dates and note" }
    const { number: n, note } = parsed.data

    const startsAt = lagosInstant(parsed.data.startsAt)
    if (!startsAt) return { success: false, error: "Enter the start as a date and time" }
    let endsAt: Date | null = null
    if (parsed.data.endsAt !== null) {
      endsAt = lagosInstant(parsed.data.endsAt)
      if (!endsAt) return { success: false, error: "Enter the end as a date and time" }
    }

    let existing: CohortLean | null = null
    if (id !== null) {
      const cid = CohortId.safeParse(id)
      if (!cid.success) return { success: false, error: "Cohort not found" }
      existing = (await Cohort.findById(cid.data).lean()) as unknown as CohortLean | null
      if (!existing) return { success: false, error: "Cohort not found" }
    }

    const others = ((await Cohort.find().lean()) as unknown as CohortLean[]).filter(
      (c) => !existing || String(c._id) !== String(existing._id)
    )

    // The rules, in order, so each case gets its own message.
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      return { success: false, error: "The end must be after the start." }
    }
    if (existing && existing.startsAt.getTime() <= Date.now()) {
      if (existing.number !== n) {
        return { success: false, error: "A cohort that has started keeps its number." }
      }
      if (startsAt.getTime() > Date.now()) {
        return { success: false, error: "A cohort that has started can't move its start into the future." }
      }
    }
    if (others.some((c) => c.number === n)) {
      return { success: false, error: `${cohortName(n)} already exists.` }
    }
    const lower = others
      .filter((c) => c.number < n)
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0]
    if (lower && startsAt.getTime() <= lower.startsAt.getTime()) {
      return {
        success: false,
        error: `${cohortName(n)} must start after ${cohortName(lower.number)} (${cohortDateFull(lower.startsAt.toISOString())}).`,
      }
    }
    const higher = others
      .filter((c) => c.number > n)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]
    if (higher && startsAt.getTime() >= higher.startsAt.getTime()) {
      return {
        success: false,
        error: `${cohortName(n)} must start before ${cohortName(higher.number)} (${cohortDateFull(higher.startsAt.toISOString())}).`,
      }
    }

    const fields = { number: n, name: cohortName(n), startsAt, endsAt, note: note || null }
    if (existing) {
      await Cohort.updateOne({ _id: existing._id }, { $set: fields })
    } else {
      await Cohort.create({ ...fields, createdBy: admin.id })
    }

    revalidatePath("/admin/cohorts")
    revalidatePath("/", "layout")
    return { success: true, data: viewOf({ number: n, startsAt, endsAt }) }
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      const n = Number(input?.number)
      return { success: false, error: `${cohortName(Number.isFinite(n) ? n : 0)} already exists.` }
    }
    console.error("[Cohorts] save failed:", err)
    return { success: false, error: "Couldn't save the cohort" }
  }
}

export async function adminCreateCohort(input: CohortFormInput): Promise<Result<CohortView>> {
  return save(null, input)
}

export async function adminUpdateCohort(id: string, input: CohortFormInput): Promise<Result<CohortView>> {
  return save(id, input)
}
