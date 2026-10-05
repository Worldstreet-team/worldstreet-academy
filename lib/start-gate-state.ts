import { cache } from "react"
import connectDB from "@/lib/db"
import { Enrollment, ManualPayment } from "@/lib/db/models"

/**
 * The two facts the gate needs, for RSC layouts: does the learner have access
 * (an active or completed enrollment — owner meeting 2026-10-03, "no dashboard
 * without paying"), and is an ESPEE proof of theirs waiting on an admin (they
 * are sent to the pending page instead of the schools). Request-deduped like
 * getCachedUser. Callers must treat a throw as "do not gate".
 */
export const getStartGateState = cache(async (userId: string) => {
  await connectDB()
  const [access, openProof] = await Promise.all([
    Enrollment.exists({ user: userId, status: { $in: ["active", "completed"] } }),
    ManualPayment.exists({ user: userId, status: "submitted" }),
  ])
  return { hasAccess: Boolean(access), hasOpenProof: Boolean(openProof) }
})
