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

export type AdminOverview = {
  totals: {
    users: number
    instructors: number
    pendingApplications: number
    publishedCourses: number
    activeEnrollments: number
    /** Sum of paid+enrolled order amounts, in minor units (cents). */
    grossRevenueMinor: number
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
  revenueByDay: { date: string; minor: number }[]
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
      Order.aggregate([
        { $match: { status: { $in: ["paid", "enrolled"] } } },
        { $group: { _id: null, total: { $sum: "$amountMinor" } } },
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
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - 13)
    const dailyAgg = await Order.aggregate([
      { $match: { status: { $in: ["paid", "enrolled"] }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          minor: { $sum: "$amountMinor" },
        },
      },
    ])
    const dailyMap = new Map((dailyAgg as { _id: string; minor: number }[]).map((d) => [d._id, d.minor]))
    const revenueByDay: { date: string; minor: number }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      revenueByDay.push({ date: key, minor: dailyMap.get(key) ?? 0 })
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
        grossRevenueMinor: (revenueAgg as { total: number }[])[0]?.total ?? 0,
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
    }
  } catch (error) {
    console.error("Admin overview error:", error)
    return null
  }
}
