import { cache } from "react"
import connectDB from "@/lib/db"
import { Course, Enrollment, ManualPayment } from "@/lib/db/models"
import { OPENS_DASHBOARD_FILTER } from "@/lib/start-gate"

/**
 * The two facts the gate needs, for RSC layouts: does the learner have access
 * (an active or completed enrollment in an Academy course on sale — owner
 * meeting 2026-10-03, "no dashboard without paying"; voice note 2026-11-02,
 * never the tutors' marketplace or a legacy free course: OPENS_DASHBOARD_FILTER),
 * and is an ESPEE proof of theirs waiting on an admin (they are sent to the
 * pending page instead of the schools). Request-deduped like getCachedUser.
 * Callers must treat a throw as "do not gate".
 */
export const getStartGateState = cache(async (userId: string) => {
  await connectDB()
  const [enrolledIn, openProof] = await Promise.all([
    Enrollment.distinct("course", { user: userId, status: { $in: ["active", "completed"] } }),
    ManualPayment.exists({ user: userId, status: "submitted" }),
  ])
  const access =
    enrolledIn.length > 0 ? await Course.exists({ _id: { $in: enrolledIn }, ...OPENS_DASHBOARD_FILTER }) : null
  return { hasAccess: Boolean(access), hasOpenProof: Boolean(openProof) }
})
