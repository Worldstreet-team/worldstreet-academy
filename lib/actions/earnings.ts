"use server"

import connectDB from "@/lib/db"
import { Types } from "mongoose"
import { Course, Enrollment, User, Order, PaymentEvent, Earning } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import {
  createWalletCredit,
  createWalletCharge,
  refundWalletCharge,
  isInsufficientBalance,
  walletEnabled,
} from "@/lib/wallet"

const WITHDRAW_URL =
  process.env.NEXT_PUBLIC_WALLET_WITHDRAW_URL || "https://dashboard.worldstreetgold.com/withdraw"

export type EarningRow = {
  id: string
  courseTitle: string
  kind: "sale" | "adjustment"
  grossMinor: number
  feeMinor: number
  netMinor: number
  status: "pending" | "cleared" | "reversed"
  availableAt: string
  clearedAt: string | null
  createdAt: string
}

export type InstructorEarnings = {
  pendingMinor: number
  clearedMinor: number
  lifetimeNetMinor: number
  totalSales: number
  clearingDays: number
  /** Withdrawals happen on the central Worldstreet dashboard, never in the Academy. */
  withdrawUrl: string
  rows: EarningRow[]
}

/**
 * Clear matured earnings for one instructor: sale rows credit their central
 * Worldstreet wallet balance (idempotent on creditReference — a rerun can
 * never double-pay), adjustment rows (post-clearing refund clawbacks) debit
 * it. Once credited, the money is ordinary Worldstreet balance and withdraws
 * through the existing dashboard flow, where KYC is enforced centrally.
 */
async function clearMaturedEarnings(instructorId: string): Promise<void> {
  if (!walletEnabled()) return

  const matured = await Earning.find({
    instructor: instructorId,
    status: "pending",
    availableAt: { $lte: new Date() },
  })
    .populate("course", "title")
    .sort({ availableAt: 1 })

  for (const earning of matured) {
    const courseTitle = (earning.course as unknown as { title?: string })?.title ?? "course"
    try {
      if (earning.netMinor >= 0) {
        await createWalletCredit(earning.instructorAuthUserId, {
          amountMinor: earning.netMinor,
          reference: earning.creditReference,
          description: `Academy earnings: ${courseTitle}`,
          metadata: { earningId: earning._id.toString(), courseId: String(earning.course) },
        })
      } else {
        await createWalletCharge(earning.instructorAuthUserId, {
          amountMinor: Math.abs(earning.netMinor),
          description: `Academy refund clawback: ${courseTitle}`,
          metadata: { earningId: earning._id.toString() },
          idempotencyKey: earning.creditReference,
        })
      }
      earning.status = "cleared"
      earning.clearedAt = new Date()
      await earning.save()
    } catch (err) {
      if (isInsufficientBalance(err)) {
        // Clawback exceeds the instructor's current balance — stays pending and
        // retries on the next clearing pass.
        continue
      }
      console.error("[Earnings] clearing failed for", earning._id.toString(), err)
    }
  }
}

/**
 * The signed-in instructor's earnings ledger. Also runs the (idempotent)
 * clearing pass so matured earnings land in their wallet on read — no cron
 * required in the serverless deployment.
 */
export async function getMyInstructorEarnings(): Promise<InstructorEarnings | null> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN")) return null

    await clearMaturedEarnings(user.id)

    const [rows, aggregates] = await Promise.all([
      Earning.find({ instructor: user.id })
        .populate("course", "title")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Earning.aggregate([
        { $match: { instructor: new Types.ObjectId(user.id) } },
        {
          $group: {
            _id: "$status",
            netMinor: { $sum: "$netMinor" },
            count: { $sum: { $cond: [{ $eq: ["$kind", "sale"] }, 1, 0] } },
          },
        },
      ]),
    ])

    let pendingMinor = 0
    let clearedMinor = 0
    let totalSales = 0
    for (const group of aggregates as { _id: string; netMinor: number; count: number }[]) {
      if (group._id === "pending") pendingMinor += group.netMinor
      if (group._id === "cleared") clearedMinor += group.netMinor
      if (group._id !== "reversed") totalSales += group.count
    }

    return {
      pendingMinor,
      clearedMinor,
      lifetimeNetMinor: pendingMinor + clearedMinor,
      totalSales,
      clearingDays: 7,
      withdrawUrl: WITHDRAW_URL,
      rows: rows.map((r) => ({
        id: r._id.toString(),
        courseTitle: (r.course as unknown as { title?: string })?.title ?? "Course",
        kind: r.kind,
        grossMinor: r.grossMinor,
        feeMinor: r.feeMinor,
        netMinor: r.netMinor,
        status: r.status,
        availableAt: r.availableAt.toISOString(),
        clearedAt: r.clearedAt ? r.clearedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  } catch (error) {
    console.error("Get instructor earnings error:", error)
    return null
  }
}

/**
 * Refund a purchase (admin only). Re-credits the student's central wallet in
 * full, revokes course access, and claws the instructor's share back from the
 * earnings ledger — pending earnings are reversed outright; already-cleared
 * earnings get a negative adjustment that debits their wallet on the next
 * clearing pass.
 */
export async function refundEnrollment(enrollmentId: string, reason: string) {
  try {
    await connectDB()
    const admin = await getCurrentUser()
    if (!admin || admin.role !== "ADMIN") {
      return { success: false, error: "Not authorized" }
    }

    const enrollment = await Enrollment.findById(enrollmentId).populate("user", "authUserId")
    if (!enrollment) return { success: false, error: "Enrollment not found" }
    if (enrollment.status === "refunded") return { success: true, alreadyRefunded: true }
    if (!enrollment.transactionId || enrollment.legacyUnpaid) {
      return { success: false, error: "No wallet charge on record for this enrollment" }
    }

    const studentAuthId = (enrollment.user as unknown as { authUserId?: string })?.authUserId
    if (!studentAuthId) return { success: false, error: "Student has no wallet identity" }

    await refundWalletCharge(studentAuthId, enrollment.transactionId, reason || "course refund")

    enrollment.status = "refunded"
    await enrollment.save()

    const order = await Order.findOne({ chargeId: enrollment.transactionId })
    if (order) {
      order.status = "refunded"
      order.history.push({ status: "refunded", at: new Date(), note: reason })
      await order.save()
      await PaymentEvent.create({
        order: order._id,
        reference: order.reference,
        type: "charge_refunded",
        payload: { chargeId: enrollment.transactionId, reason, by: admin.id },
      })
    }

    // Newest first: a re-purchased course has one sale row per generation, and
    // it's the current one being refunded.
    const earning = await Earning.findOne({ enrollment: enrollment._id, kind: "sale" }).sort({
      createdAt: -1,
    })
    if (earning) {
      if (earning.status === "pending") {
        earning.status = "reversed"
        earning.note = `refund before clearing: ${reason}`
        await earning.save()
      } else if (earning.status === "cleared") {
        await Earning.create({
          enrollment: enrollment._id,
          order: order?._id ?? null,
          course: earning.course,
          instructor: earning.instructor,
          instructorAuthUserId: earning.instructorAuthUserId,
          student: earning.student,
          kind: "adjustment",
          grossMinor: -earning.grossMinor,
          feeMinor: -earning.feeMinor,
          netMinor: -earning.netMinor,
          currency: earning.currency,
          status: "pending",
          availableAt: new Date(),
          // Keyed on the earning being reversed, not the enrollment: a
          // re-purchased-then-refunded course would collide on the latter.
          creditReference: `academy_clawback_${earning._id.toString()}`,
          chargeId: earning.chargeId,
          note: `refund after clearing: ${reason}`,
        })
      }
    }

    await Course.findByIdAndUpdate(enrollment.course, { $inc: { enrolledCount: -1 } })
    const course = await Course.findById(enrollment.course).select("instructor")
    if (course) {
      await User.findByIdAndUpdate(course.instructor, {
        $inc: { "instructorProfile.totalStudents": -1 },
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Refund enrollment error:", error)
    return { success: false, error: "Refund failed — nothing was changed on the wallet side beyond what succeeded; check payment events" }
  }
}
