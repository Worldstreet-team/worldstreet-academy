import "server-only"

import { cache } from "react"
import { connection } from "next/server"
import type { Types } from "mongoose"
import connectDB from "@/lib/db"
import { Cohort, ManualPayment } from "@/lib/db/models"
import {
  calendarOf,
  cohortForEnrolment,
  cohortName,
  enrolmentInstant,
  fallbackCohort,
  type CohortCalendar,
  type CohortView,
} from "@/lib/cohort-rules"

/**
 * The Academy's cohorts, read once per request (Phase 12, D20). While the
 * collection is empty (or the read fails) the calendar holds one cohort built
 * from today's env constants, so nothing changes until an admin adds a cohort.
 */
export const getCohortCalendar = cache(async (): Promise<CohortCalendar> => {
  // Ruling 4: first statement, outside the try. During a build `connection()`
  // throws a Next-internal signal that marks the route dynamic; swallowing it
  // would freeze the page's cohort into the build.
  await connection()

  let list: CohortView[] = []
  try {
    await connectDB()
    const rows = await Cohort.find().select("number startsAt endsAt").lean()
    list = rows.map((r) => ({
      number: r.number,
      name: cohortName(r.number),
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    }))
  } catch (err) {
    console.error("[Cohorts] read failed:", err)
  }
  if (list.length === 0) {
    list = [
      fallbackCohort(
        process.env.NEXT_PUBLIC_COHORT_STARTS_AT,
        process.env.NEXT_PUBLIC_COHORT_NUMBER
      ),
    ]
  }
  return calendarOf(list, Date.now())
})

export type EnrolmentRow = {
  _id: Types.ObjectId | string
  purchasedAt?: Date | null
  createdAt?: Date | null
}

/**
 * Each enrolment's cohort, keyed by `String(row._id)`. One read of the approved
 * ESPEE proofs gives the earliest submission per enrolment (ruling 2). Callers
 * pass only the rows ruling 3 allows (active or completed program enrolments).
 */
export async function cohortsForEnrollments(
  rows: EnrolmentRow[]
): Promise<Map<string, CohortView | null>> {
  const out = new Map<string, CohortView | null>()
  if (rows.length === 0) return out

  const calendar = await getCohortCalendar()
  const earliest = new Map<string, Date>()
  try {
    await connectDB()
    const proofs = await ManualPayment.find({
      status: "approved",
      enrollment: { $in: rows.map((r) => r._id) },
    })
      .select("enrollment createdAt")
      .lean()
    for (const p of proofs) {
      if (!p.enrollment) continue
      const key = String(p.enrollment)
      const seen = earliest.get(key)
      if (!seen || p.createdAt.getTime() < seen.getTime()) earliest.set(key, p.createdAt)
    }
  } catch (err) {
    console.error("[Cohorts] proof read failed:", err)
  }

  for (const row of rows) {
    const key = String(row._id)
    out.set(key, cohortForEnrolment(calendar.all, enrolmentInstant(row, earliest.get(key) ?? null)))
  }
  return out
}
