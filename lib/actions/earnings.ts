"use server"

import connectDB from "@/lib/db"
import { Types } from "mongoose"
import { Course, Enrollment, User, Order, PaymentEvent, Earning, type IEarning } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { getSellerStatus } from "@/lib/seller"
import { maskedName } from "@/lib/masked-name"
import {
  createWalletCredit,
  createWalletCharge,
  refundWalletCharge,
  isInsufficientBalance,
  walletEnabled,
  WalletError,
} from "@/lib/wallet"

// Default: the in-academy wallet withdrawal page (Phase 4). The env override
// remains for pointing back at the central dashboard if ever needed.
const WITHDRAW_URL = process.env.NEXT_PUBLIC_WALLET_WITHDRAW_URL || "/dashboard/wallet/withdraw"

export type EarningRow = {
  id: string
  courseTitle: string
  courseId: string
  /** The buyer, masked to "First L."; null when the row has no student. */
  learnerName: string | null
  kind: "sale" | "adjustment" | "referral"
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
  /** Net per program (sales minus refunds, not reversed; partner commissions excluded), highest first. */
  byCourse: { courseId: string; courseTitle: string; netMinor: number; sales: number }[]
}

/** Of these earnings' enrollments, the ones refunded or cancelled — whose earnings must not pay out. */
async function heldEnrollmentIds(earnings: IEarning[]): Promise<Set<string>> {
  const ids = earnings.filter((e) => e.netMinor > 0 && e.enrollment).map((e) => e.enrollment)
  if (ids.length === 0) return new Set()
  const rows = await Enrollment.find({ _id: { $in: ids }, status: { $in: ["refunded", "cancelled"] } })
    .select("_id")
    .lean()
  return new Set(rows.map((r) => String(r._id)))
}

/**
 * Claims a matured earning for its payout (2026-11-12): "cleared" is written
 * BEFORE the money moves, and only while it is still "pending". A cancellation
 * landing meanwhile then leaves it alone (it reverses only pending earnings),
 * and a refund books a clawback for it, instead of either reversing an earning
 * whose credit is already on its way. There is no "clearing" status in the
 * shared model, so "cleared" is the claim; `releaseEarningClaim` undoes it when
 * the wallet doesn't pay. Returns the claim's time, or null when it was taken.
 */
async function claimEarning(earningId: Types.ObjectId): Promise<Date | null> {
  const claimedAt = new Date()
  const claim = await Earning.updateOne(
    { _id: earningId, status: "pending" },
    { $set: { status: "cleared", clearedAt: claimedAt } }
  )
  return claim.modifiedCount === 1 ? claimedAt : null
}

/**
 * The wallet didn't pay a claimed earning: back to "pending" for the next pass,
 * which replays the same reference (the wallet dedupes it, so an answer lost
 * in a timeout can't pay twice). On the wallet's own refusal no money moved,
 * so a refund that booked a clawback while it was claimed has nothing to claw
 * back: both are reversed.
 */
async function releaseEarningClaim(earning: IEarning, claimedAt: Date, err: unknown): Promise<void> {
  await Earning.updateOne(
    { _id: earning._id, status: "cleared", clearedAt: claimedAt },
    { $set: { status: "pending", clearedAt: null } }
  )
  const refused = err instanceof WalletError && err.status < 500 && err.code !== "WALLET_UNAVAILABLE"
  const clawback = await Earning.findOne({ creditReference: `academy_clawback_${earning._id.toString()}` })
    .select("_id status")
    .lean()
  if (!clawback) return
  if (!refused) {
    // The credit may have gone through: the clawback stands, and needs a look.
    console.error("[Earnings] refunded while its payout was unconfirmed — check the wallet:", earning._id.toString())
    return
  }
  const voided = await Earning.updateOne(
    { _id: clawback._id, status: "pending" },
    { $set: { status: "reversed", note: "payout refused while the purchase was refunded: nothing to claw back" } }
  )
  if (voided.modifiedCount === 1) {
    await Earning.updateOne(
      { _id: earning._id, status: "pending" },
      { $set: { status: "reversed", note: "refund before clearing (its payout was refused)" } }
    )
  }
}

/**
 * Clear matured earnings for one instructor: sale and referral rows credit
 * their central Worldstreet wallet balance (idempotent on creditReference — a
 * rerun can never double-pay), adjustment rows (post-clearing refund
 * clawbacks) debit it. Once credited, the money is ordinary Worldstreet
 * balance and withdraws through the existing dashboard flow, where KYC is
 * enforced centrally.
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

  // Never pay out a share of a purchase that was refunded or cancelled
  // (2026-11-12). The refund or cancellation reverses its pending earnings; if
  // that write failed, the earning is still pending here, and stays so.
  const held = await heldEnrollmentIds(matured)

  for (const earning of matured) {
    const courseTitle = (earning.course as unknown as { title?: string })?.title ?? "course"
    if (earning.netMinor > 0 && earning.enrollment && held.has(String(earning.enrollment))) {
      console.error("[Earnings] not clearing an earning of a refunded or cancelled enrollment:", earning._id.toString())
      continue
    }
    // Claimed before the money moves (2026-11-12); another pass, a cancellation or a refund may have it.
    const claimedAt = await claimEarning(earning._id)
    if (!claimedAt) continue
    try {
      if (earning.netMinor >= 0) {
        await createWalletCredit(earning.instructorAuthUserId, {
          amountMinor: earning.netMinor,
          reference: earning.creditReference,
          description:
            earning.kind === "referral" ? `Academy referral commission: ${courseTitle}` : `Academy earnings: ${courseTitle}`,
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
      // 2026-11-12: already "cleared" by the claim. A whole-document save here overwrote a status
      // written meanwhile (a cancellation's "reversed"). Was:
      // earning.status = "cleared"
      // earning.clearedAt = new Date()
      // await earning.save()
    } catch (err) {
      await releaseEarningClaim(earning, claimedAt, err).catch((releaseErr) =>
        console.error("[Earnings] couldn't release a claimed earning:", earning._id.toString(), releaseErr)
      )
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
    if (!user) return null
    // Faculty, and approved marketplace sellers (USERs who sell their own courses).
    if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN" && (await getSellerStatus(user.id)) !== "approved") return null

    await clearMaturedEarnings(user.id)

    const [rows, aggregates, courseGroups] = await Promise.all([
      Earning.find({ instructor: user.id })
        .populate("course", "title")
        .populate("student", "firstName lastName")
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
      Earning.aggregate<{ _id: Types.ObjectId; netMinor: number; sales: number }>([
        { $match: { instructor: new Types.ObjectId(user.id), kind: { $in: ["sale", "adjustment"] }, status: { $ne: "reversed" } } },
        { $group: { _id: "$course", netMinor: { $sum: "$netMinor" }, sales: { $sum: { $cond: [{ $eq: ["$kind", "sale"] }, 1, 0] } } } },
      ]),
    ])

    const titles = new Map(
      (await Course.find({ _id: { $in: courseGroups.map((g) => g._id) } }).select("title").lean()).map((c) => [String(c._id), c.title])
    )
    const byCourse = courseGroups
      .map((g) => ({ courseId: String(g._id), courseTitle: titles.get(String(g._id)) ?? "Deleted program", netMinor: g.netMinor, sales: g.sales }))
      .sort((a, b) => b.netMinor - a.netMinor)

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
      byCourse,
      rows: rows.map((r) => {
        const student = r.student as unknown as { firstName?: string; lastName?: string } | null
        return {
        id: r._id.toString(),
        courseTitle: (r.course as unknown as { title?: string } | null)?.title ?? "Deleted program",
        courseId: String((r.course as { _id?: unknown })?._id ?? r.course),
        learnerName: student ? maskedName(student.firstName, student.lastName) : null,
        kind: r.kind,
        grossMinor: r.grossMinor,
        feeMinor: r.feeMinor,
        netMinor: r.netMinor,
        status: r.status,
        availableAt: r.availableAt.toISOString(),
        clearedAt: r.clearedAt ? r.clearedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        }
      }),
    }
  } catch (error) {
    console.error("Get instructor earnings error:", error)
    return null
  }
}

/**
 * Take a refunded purchase's earning back — a sale's share or a referral
 * commission alike. Pending: reversed outright, it never reaches a wallet.
 * Cleared: a negative adjustment that debits the earner's wallet on the next
 * clearing pass.
 */
async function clawBack(earning: IEarning, orderId: Types.ObjectId | null, reason: string): Promise<void> {
  const label = earning.kind === "referral" ? "referral refunded" : "refund"
  // 2026-11-12: reversed only while still pending. A clearing pass may claim it meanwhile ("cleared"
  // before its credit goes out), and a whole-document save overwrote that, so the credit went out on
  // a "reversed" earning with nothing to claw it back. Was:
  // if (earning.status === "pending") {
  //   earning.status = "reversed"
  //   earning.note = `${label} before clearing: ${reason}`
  //   await earning.save()
  // } else if (earning.status === "cleared") {
  let status = earning.status
  if (status === "pending") {
    const reversed = await Earning.updateOne(
      { _id: earning._id, status: "pending" },
      { $set: { status: "reversed", note: `${label} before clearing: ${reason}` } }
    )
    if (reversed.modifiedCount === 1) return
    // Claimed for its payout in the meantime: read what it is now.
    status = (await Earning.findById(earning._id).select("status").lean())?.status ?? status
    if (status === "pending") {
      // The payout was refused and released: reverse it after all.
      await Earning.updateOne(
        { _id: earning._id, status: "pending" },
        { $set: { status: "reversed", note: `${label} before clearing: ${reason}` } }
      )
      return
    }
  }
  if (status === "cleared") {
    // 2026-11-12: a refund retried after a partial failure walks the same
    // earnings again; the unique reference means this one is already booked.
    try {
      await Earning.create({
        enrollment: earning.enrollment,
        order: orderId,
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
        note: `${label} after clearing: ${reason}`,
      })
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err
    }
  }
}

/**
 * Refund a purchase (admin only). Re-credits the student's central wallet in
 * full, revokes course access, and claws the instructor's share — and any
 * referral commission the purchase paid — back from the earnings ledger:
 * pending earnings are reversed outright; already-cleared earnings get a
 * negative adjustment that debits their wallet on the next clearing pass.
 */
export async function refundEnrollment(enrollmentId: string, reason: string) {
  try {
    await connectDB()
    const admin = await getCurrentUser()
    if (!admin || admin.role !== "ADMIN") {
      return { success: false, error: "Not authorized" }
    }
    // Only a 24-hex id reaches the query: findById({ $ne: null }) would match some other enrollment.
    if (typeof enrollmentId !== "string" || !/^[a-f0-9]{24}$/i.test(enrollmentId)) {
      return { success: false, error: "Enrollment not found" }
    }

    const enrollment = await Enrollment.findById(enrollmentId).populate("user", "authUserId")
    if (!enrollment) return { success: false, error: "Enrollment not found" }
    // Four eyes on money (2026-11-12), as on transfers, grants and enrollment changes: no admin refunds
    // their own purchase. Checked before the wallet is touched.
    const buyerId = String((enrollment.user as unknown as { _id?: unknown } | null)?._id ?? enrollment.user)
    if (buyerId === admin.id) {
      return { success: false, error: "Another admin has to refund your own purchase" }
    }
    if (enrollment.status === "refunded") return { success: true, alreadyRefunded: true }
    if (!enrollment.transactionId || enrollment.legacyUnpaid) {
      return { success: false, error: "No wallet charge on record for this enrollment" }
    }

    const studentAuthId = (enrollment.user as unknown as { authUserId?: string })?.authUserId
    if (!studentAuthId) return { success: false, error: "Student has no wallet identity" }

    // 2026-11-12: a place moved up a plan holds one charge per upgrade beside
    // its purchase (Order kind "upgrade"). Every one is refunded, each by its
    // own charge id (the wallet's refund is idempotent per charge), and each
    // order is marked refunded the moment its refund lands, so a retry after a
    // partial failure skips it instead of asking the wallet again. The place is
    // revoked only once every charge is back. Was a single refund:
    // await refundWalletCharge(studentAuthId, enrollment.transactionId, reason || "course refund")
    const order = await Order.findOne({ chargeId: enrollment.transactionId })
    const upgradeOrders = await Order.find({
      user: buyerId,
      course: enrollment.course,
      kind: "upgrade",
      enrollment: enrollment._id,
      // "failed" with a charge: charged, then its own compensating refund failed.
      status: { $in: ["paid", "enrolled", "failed"] },
      chargeId: { $nin: [null, ""] },
    })
    const toRefund = [
      { chargeId: enrollment.transactionId, order },
      ...upgradeOrders.flatMap((o) => (o.chargeId ? [{ chargeId: o.chargeId, order: o }] : [])),
    ]
    let refundedCount = 0
    for (const item of toRefund) {
      if (item.order?.status === "refunded") {
        refundedCount++
        continue
      }
      try {
        await refundWalletCharge(studentAuthId, item.chargeId, reason || "course refund")
      } catch (err) {
        console.error("[Refunds] wallet refund failed:", item.chargeId, err)
        return {
          success: false,
          error:
            refundedCount > 0
              ? `Refunded ${refundedCount} of ${toRefund.length} payments for this place; the rest didn't go through. Try again: payments already refunded won't be refunded twice.`
              : "The wallet didn't take the refund, so nothing was refunded. Try again.",
        }
      }
      refundedCount++
      if (item.order) {
        await Order.updateOne(
          { _id: item.order._id, status: { $ne: "refunded" } },
          { $set: { status: "refunded" }, $push: { history: { status: "refunded", at: new Date(), note: reason } } }
        )
        await PaymentEvent.create({
          order: item.order._id,
          reference: item.order.reference,
          type: "charge_refunded",
          payload: { chargeId: item.chargeId, reason, by: admin.id },
        }).catch((err) => console.error("[Refunds] failed to log a refund event:", item.chargeId, err))
      }
    }

    // Claim the refund atomically: of two clicks that both got past the status
    // check above, only one runs the clawbacks and counters below. (The wallet
    // refund itself is idempotent, so the second click moved no money.)
    const claimed = await Enrollment.findOneAndUpdate(
      { _id: enrollment._id, status: { $ne: "refunded" } },
      { $set: { status: "refunded" } }
    )
    if (!claimed) return { success: true, alreadyRefunded: true }

    // 2026-11-12: the purchase order is marked refunded above, beside each upgrade's. Was:
    // const order = await Order.findOne({ chargeId: enrollment.transactionId })
    // if (order) {
    //   order.status = "refunded"
    //   order.history.push({ status: "refunded", at: new Date(), note: reason })
    //   await order.save()
    //   await PaymentEvent.create({
    //     order: order._id,
    //     reference: order.reference,
    //     type: "charge_refunded",
    //     payload: { chargeId: enrollment.transactionId, reason, by: admin.id },
    //   })
    // }

    // Newest first: a re-purchased course has one sale row per generation, and
    // it's the current one being refunded.
    // 2026-11-12: an upgrade books a sale row too, and may be the newest, so the
    // purchase's row is matched on the purchase charge first; failing that, the
    // newest row that isn't an upgrade's. Was:
    // const earning = await Earning.findOne({ enrollment: enrollment._id, kind: "sale" }).sort({
    //   createdAt: -1,
    // })
    const earning =
      (await Earning.findOne({ enrollment: enrollment._id, kind: "sale", chargeId: enrollment.transactionId }).sort({
        createdAt: -1,
      })) ??
      (await Earning.findOne({
        enrollment: enrollment._id,
        kind: "sale",
        creditReference: { $not: /^academy_earn_upgrade_/ },
      }).sort({ createdAt: -1 }))
    if (earning) await clawBack(earning, order?._id ?? null, reason)

    // The referral commission this purchase paid, if any, gets the same
    // treatment. Matched on the refunded charge, so a commission from an
    // earlier generation of this enrollment is never clawed back twice.
    const commission = await Earning.findOne({
      enrollment: enrollment._id,
      kind: "referral",
      chargeId: enrollment.transactionId,
    })
    if (commission) await clawBack(commission, order?._id ?? null, reason)

    // 2026-11-12: each upgrade's own sale share and referral commission, matched
    // on its order. An earlier generation's are already reversed or clawed back
    // (clawBack skips a reversed row and books a clawback once).
    const refundedUpgrades = await Order.find({
      user: buyerId,
      course: enrollment.course,
      kind: "upgrade",
      enrollment: enrollment._id,
      status: "refunded",
    }).select("_id")
    if (refundedUpgrades.length > 0) {
      const upgradeEarnings = await Earning.find({
        order: { $in: refundedUpgrades.map((o) => o._id) },
        kind: { $in: ["sale", "referral"] },
        status: { $ne: "reversed" },
      })
      for (const e of upgradeEarnings) await clawBack(e, e.order ?? null, reason)
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
