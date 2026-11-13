import { cache } from "react"
import connectDB from "@/lib/db"
import { getCachedUser } from "@/lib/auth/cached"
// 2026-11-12: AccessGrant for payments recorded onto a seat the learner already had. Was:
// import { Course, Enrollment, ManualPayment } from "@/lib/db/models"
import { AccessGrant, Course, Enrollment, ManualPayment } from "@/lib/db/models"
import { ON_SALE_FILTER } from "@/lib/entitlements"
// 2026-11-12: plus the paid-seat rule. Was:
// import { OPENS_DASHBOARD_FILTER, needsSchoolChoice } from "@/lib/start-gate"
import { ACADEMY_KIND_FILTER, OPENS_DASHBOARD_FILTER, isPaidEnrollment, needsSchoolChoice } from "@/lib/start-gate"

/**
 * The two facts the gate needs, for RSC layouts: does the learner have access
 * (an active or completed enrollment in an Academy course on sale — owner
 * meeting 2026-10-03, "no dashboard without paying"; voice note 2026-11-02,
 * never the tutors' marketplace or a legacy free course: OPENS_DASHBOARD_FILTER
 * — or, since 2026-11-12, one of an Academy kind that they paid for, on sale or
 * not: ACADEMY_KIND_FILTER + isPaidEnrollment),
 * and is an ESPEE proof of theirs waiting on an admin (they are sent to the
 * pending page instead of the schools). Request-deduped like getCachedUser.
 * Callers must treat a throw as "do not gate".
 *
 * A hidden (archived) program still counts: neither rule reads its status.
 */
export const getStartGateState = cache(async (userId: string) => {
  await connectDB()
  // 2026-11-12 (Owen): a seat's payment decides, so taking a program off sale
  // (plans disabled, price removed) no longer shuts out the learners who paid for it. Was:
  // const [enrolledIn, openProof] = await Promise.all([
  //   Enrollment.distinct("course", { user: userId, status: { $in: ["active", "completed"] } }),
  //   ManualPayment.exists({ user: userId, status: "submitted" }),
  // ])
  // const access =
  //   enrolledIn.length > 0 ? await Course.exists({ _id: { $in: enrolledIn }, ...OPENS_DASHBOARD_FILTER }) : null
  const [seats, openProof] = await Promise.all([
    Enrollment.find({ user: userId, status: { $in: ["active", "completed"] } })
      .select("course pricePaid transactionId")
      .lean(),
    ManualPayment.exists({ user: userId, status: "submitted" }),
  ])
  const enrolledIn = seats.map((s) => s.course)
  const paidFor = seats.filter(isPaidEnrollment).map((s) => s.course)
  // One read: an Academy course of theirs that is on sale now, or that they paid for.
  let access =
    enrolledIn.length === 0
      ? null
      : await Course.exists(
          paidFor.length === 0
            ? { _id: { $in: enrolledIn }, ...OPENS_DASHBOARD_FILTER }
            : {
                ...ACADEMY_KIND_FILTER,
                $or: [{ _id: { $in: enrolledIn }, ...ON_SALE_FILTER }, { _id: { $in: paidFor } }],
              }
        )
  // A payment an admin recorded onto a seat the learner already had
  // (AccessGrant.alreadyHadAccess) leaves that seat's price at what it was, so
  // ask the grant. Runs only for a learner nothing above let in who holds an
  // unpaid seat (a legacy free course, say); the collection is small.
  if (!access) {
    const unpaidSeats = seats.filter((s) => !isPaidEnrollment(s)).map((s) => s.course)
    if (unpaidSeats.length > 0) {
      const granted = await AccessGrant.distinct("course", { user: userId, status: "opened", course: { $in: unpaidSeats } })
      if (granted.length > 0) access = await Course.exists({ _id: { $in: granted }, ...ACADEMY_KIND_FILTER })
    }
  }
  return { hasAccess: Boolean(access), hasOpenProof: Boolean(openProof) }
})

/**
 * The gate's welcome (GateNotice), for a signed-in learner the school-first
 * gate would still send to the schools (`?start=1` alone is not enough: an
 * enrolled learner can follow an old `/dashboard/start` link too). Fails
 * closed to no notice. Shared by `/schools` and `/schools/[slug]`, the two
 * places the gate sends a learner (`schoolsPathFor`).
 */
export async function gateWelcome(): Promise<{ firstName: string } | null> {
  const user = await getCachedUser()
  if (!user || user.role !== "USER") return null
  const gate = await getStartGateState(user.id).catch(() => null)
  if (!gate) return null
  const sent = needsSchoolChoice({
    role: user.role,
    instructorStatus: user.instructorStatus,
    pathname: "/dashboard",
    ...gate,
  })
  return sent ? { firstName: (user.firstName ?? "").trim() } : null
}
