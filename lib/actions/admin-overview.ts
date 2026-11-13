"use server"

import connectDB from "@/lib/db"
import {
  User,
  Course,
  Enrollment,
  Order,
  Earning,
  InstructorApplication,
  PaymentEvent,
} from "@/lib/db/models"
import { requireAdmin } from "@/lib/auth/admin"
import { COHORT_TIME_ZONE, COHORT_UTC_OFFSET, lagosLocal } from "@/lib/cohort"
import { TRANSFER_METHODS } from "@/lib/payment-channels"

const DAY_MS = 24 * 60 * 60 * 1000

/*
 * Revenue by channel (owner, 2026-11-12). "Through WorldStreet" is an order the
 * central wallet charged: paymentMethod "wallet", or missing on orders written
 * before the field existed. "Recorded outside" is money that moved outside the
 * platform and that an admin recorded: an approved transfer proof
 * (lib/actions/manual-payments.ts) or a paid-outside learner (openAccessGrant,
 * lib/access-grants.ts), both with a transfer method and no chargeId. Read
 * only: no order is changed.
 */
/** Aggregation: true for an order recorded outside the platform. */
const RECORDED_OUTSIDE = { $in: [{ $ifNull: ["$paymentMethod", "wallet"] }, [...TRANSFER_METHODS]] }

export type AdminOverview = {
  totals: {
    users: number
    instructors: number
    pendingApplications: number
    publishedCourses: number
    activeEnrollments: number
    /** Sum of paid+enrolled order amounts, in minor units (cents). */
    grossRevenueMinor: number
    /** Of which charged through the WorldStreet wallet (minor units). */
    worldStreetRevenueMinor: number
    /** Of which paid outside the platform and recorded by an admin (minor units). */
    outsideRevenueMinor: number
    pendingEarningsMinor: number
    clearedEarningsMinor: number
  }
  recentApplications: {
    id: string
    applicantName: string
    applicantAvatar: string | null
    headline: string
    status: string
    createdAt: string
  }[]
  recentPaymentEvents: {
    id: string
    type: string
    reference: string
    createdAt: string
  }[]
  /** Gross order revenue per day, oldest→newest, last 14 days (minor units). */
  // 2026-11-12: each day split by channel too; `minor` stays the day's total.
  // revenueByDay: { date: string; minor: number }[]
  revenueByDay: { date: string; minor: number; worldStreetMinor: number; outsideMinor: number }[]
  /** Instructor-application funnel over the last 30 days. */
  funnel: {
    submitted30d: number
    approved30d: number
    rejected30d: number
    approvalRatePct: number | null
  }
}

export async function getAdminOverview(): Promise<AdminOverview | null> {
  try {
    await connectDB()
    await requireAdmin()

    const [
      users,
      instructors,
      pendingApplications,
      publishedCourses,
      activeEnrollments,
      revenueAgg,
      earningsAgg,
      recentApps,
      recentEvents,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: { $in: ["INSTRUCTOR", "ADMIN"] } }),
      InstructorApplication.countDocuments({
        status: { $in: ["submitted", "under_review", "interview_scheduled"] },
      }),
      Course.countDocuments({ status: "published" }),
      Enrollment.countDocuments({ status: { $in: ["active", "completed"] } }),
      // 2026-11-12: one row per channel (_id true = recorded outside), summed for the total below.
      // Order.aggregate([
      //   { $match: { status: { $in: ["paid", "enrolled"] } } },
      //   { $group: { _id: null, total: { $sum: "$amountMinor" } } },
      // ]),
      Order.aggregate([
        { $match: { status: { $in: ["paid", "enrolled"] } } },
        { $group: { _id: RECORDED_OUTSIDE, total: { $sum: "$amountMinor" } } },
      ]),
      Earning.aggregate([
        { $match: { status: { $in: ["pending", "cleared"] } } },
        { $group: { _id: "$status", total: { $sum: "$netMinor" } } },
      ]),
      InstructorApplication.find({})
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("user", "firstName lastName avatarUrl")
        .lean(),
      PaymentEvent.find({}).sort({ createdAt: -1 }).limit(8).lean(),
    ])

    // Revenue per day over the trailing 14 days (paid/enrolled orders).
    // 2026-11-12: Lagos days, the admins' and the Academy's. The server's UTC days put an
    // order made between midnight and 1am in Lagos on the day before.
    // const since = new Date()
    // since.setHours(0, 0, 0, 0)
    // since.setDate(since.getDate() - 13)
    const todayInLagos = lagosLocal(new Date().toISOString()).slice(0, 10)
    // Africa/Lagos has no daylight saving, so a day is always 24 hours.
    const since = new Date(Date.parse(`${todayInLagos}T00:00:00${COHORT_UTC_OFFSET}`) - 13 * DAY_MS)
    const dailyAgg = await Order.aggregate([
      { $match: { status: { $in: ["paid", "enrolled"] }, createdAt: { $gte: since } } },
      {
        $group: {
          // _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: COHORT_TIME_ZONE } },
          minor: { $sum: "$amountMinor" },
          // 2026-11-12: the day's money recorded outside the platform; the rest went through WorldStreet.
          outsideMinor: { $sum: { $cond: [RECORDED_OUTSIDE, "$amountMinor", 0] } },
        },
      },
    ])
    // 2026-11-12: each day keeps its channel split.
    // const dailyMap = new Map((dailyAgg as { _id: string; minor: number }[]).map((d) => [d._id, d.minor]))
    // const revenueByDay: { date: string; minor: number }[] = []
    const dailyMap = new Map((dailyAgg as { _id: string; minor: number; outsideMinor: number }[]).map((d) => [d._id, d]))
    const revenueByDay: AdminOverview["revenueByDay"] = []
    for (let i = 0; i < 14; i++) {
      // const d = new Date(since)
      // d.setDate(since.getDate() + i)
      // const key = d.toISOString().slice(0, 10)
      const key = lagosLocal(new Date(since.getTime() + i * DAY_MS).toISOString()).slice(0, 10)
      // revenueByDay.push({ date: key, minor: dailyMap.get(key) ?? 0 })
      const day = dailyMap.get(key)
      const minor = day?.minor ?? 0
      const outsideMinor = day?.outsideMinor ?? 0
      revenueByDay.push({ date: key, minor, worldStreetMinor: minor - outsideMinor, outsideMinor })
    }

    // Application funnel, trailing 30 days.
    const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const [submitted30d, approved30d, rejected30d] = await Promise.all([
      InstructorApplication.countDocuments({ createdAt: { $gte: since30 } }),
      InstructorApplication.countDocuments({ status: "approved", decidedAt: { $gte: since30 } }),
      InstructorApplication.countDocuments({ status: "rejected", decidedAt: { $gte: since30 } }),
    ])
    const decided = approved30d + rejected30d
    const funnel = {
      submitted30d,
      approved30d,
      rejected30d,
      approvalRatePct: decided > 0 ? Math.round((approved30d / decided) * 100) : null,
    }

    let worldStreetRevenueMinor = 0
    let outsideRevenueMinor = 0
    for (const g of revenueAgg as { _id: boolean; total: number }[]) {
      if (g._id === true) outsideRevenueMinor += g.total
      else worldStreetRevenueMinor += g.total
    }

    let pendingEarningsMinor = 0
    let clearedEarningsMinor = 0
    for (const g of earningsAgg as { _id: string; total: number }[]) {
      if (g._id === "pending") pendingEarningsMinor = g.total
      if (g._id === "cleared") clearedEarningsMinor = g.total
    }

    return {
      totals: {
        users,
        instructors,
        pendingApplications,
        publishedCourses,
        activeEnrollments,
        // grossRevenueMinor: (revenueAgg as { total: number }[])[0]?.total ?? 0,
        grossRevenueMinor: worldStreetRevenueMinor + outsideRevenueMinor,
        worldStreetRevenueMinor,
        outsideRevenueMinor,
        pendingEarningsMinor,
        clearedEarningsMinor,
      },
      recentApplications: recentApps.map((a) => {
        const applicant = a.user as unknown as {
          firstName?: string
          lastName?: string
          avatarUrl?: string | null
        } | null
        return {
          id: a._id.toString(),
          applicantName: applicant
            ? `${applicant.firstName ?? ""} ${applicant.lastName ?? ""}`.trim() || "Unknown"
            : "Unknown",
          applicantAvatar: applicant?.avatarUrl ?? null,
          headline: a.answers?.headline ?? "",
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        }
      }),
      recentPaymentEvents: recentEvents.map((e) => ({
        id: e._id.toString(),
        type: e.type,
        reference: e.reference,
        createdAt: e.createdAt.toISOString(),
      })),
      revenueByDay,
      funnel,
    }
  } catch (error) {
    console.error("Admin overview error:", error)
    return null
  }
}
