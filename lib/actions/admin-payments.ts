"use server"

import connectDB from "@/lib/db"
import { Order, PaymentEvent, Enrollment, Earning } from "@/lib/db/models"
import type { PackageKey } from "@/lib/db/models"
import { requireAdmin } from "@/lib/auth/admin"
import { TRANSFER_METHODS } from "@/lib/payment-channels"
import { getWalletCharge, listUserCharges, walletEnabled, type UserChargeItem } from "@/lib/wallet"

const PAGE_SIZE = 20

export type AdminOrderRow = {
  id: string
  reference: string
  status: string
  amountMinor: number
  currency: string
  chargeId: string | null
  packageKey: PackageKey | null
  buyerName: string
  buyerEmail: string
  courseTitle: string
  createdAt: string
}

export async function adminListOrders(filters?: {
  status?: string
  page?: number
}): Promise<{ orders: AdminOrderRow[]; total: number; page: number; pageCount: number }> {
  const empty = { orders: [], total: 0, page: 1, pageCount: 1 }
  try {
    await connectDB()
    await requireAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    if (filters?.status && filters.status !== "all") query.status = filters.status

    const [rows, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("user", "firstName lastName email")
        .populate("course", "title")
        .lean(),
      Order.countDocuments(query),
    ])

    return {
      orders: rows.map((o) => {
        const buyer = o.user as unknown as { firstName?: string; lastName?: string; email?: string } | null
        const course = o.course as unknown as { title?: string } | null
        return {
          id: o._id.toString(),
          reference: o.reference,
          status: o.status,
          amountMinor: o.amountMinor,
          currency: o.currency,
          chargeId: o.chargeId,
          packageKey: o.packageKey ?? null,
          buyerName: buyer ? `${buyer.firstName ?? ""} ${buyer.lastName ?? ""}`.trim() || "Unknown" : "Unknown",
          buyerEmail: buyer?.email ?? "",
          courseTitle: course?.title ?? "Course",
          createdAt: o.createdAt.toISOString(),
        }
      }),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    }
  } catch (error) {
    console.error("Admin list orders error:", error)
    return empty
  }
}

export type AdminOrderDetail = AdminOrderRow & {
  history: { status: string; at: string; note?: string }[]
  events: { id: string; type: string; createdAt: string }[]
  enrollment: { id: string; status: string } | null
  earning: { id: string; status: string; netMinor: number } | null
  /** Whether the refund button should be offered. */
  refundable: boolean
}

export async function adminGetOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  try {
    await connectDB()
    await requireAdmin()

    const o = await Order.findById(orderId)
      .populate("user", "firstName lastName email")
      .populate("course", "title")
      .lean()
    if (!o) return null

    const [events, enrollment] = await Promise.all([
      PaymentEvent.find({ order: o._id }).sort({ createdAt: 1 }).lean(),
      o.chargeId ? Enrollment.findOne({ transactionId: o.chargeId }).lean() : null,
    ])
    const earning = enrollment
      ? await Earning.findOne({ enrollment: enrollment._id, kind: "sale" }).sort({ createdAt: -1 }).lean()
      : null

    const buyer = o.user as unknown as { firstName?: string; lastName?: string; email?: string } | null
    const course = o.course as unknown as { title?: string } | null

    return {
      id: o._id.toString(),
      reference: o.reference,
      status: o.status,
      amountMinor: o.amountMinor,
      currency: o.currency,
      chargeId: o.chargeId,
      packageKey: o.packageKey ?? null,
      buyerName: buyer ? `${buyer.firstName ?? ""} ${buyer.lastName ?? ""}`.trim() || "Unknown" : "Unknown",
      buyerEmail: buyer?.email ?? "",
      courseTitle: course?.title ?? "Course",
      createdAt: o.createdAt.toISOString(),
      history: (o.history ?? []).map((h) => ({
        status: h.status,
        at: new Date(h.at).toISOString(),
        note: h.note,
      })),
      events: events.map((e) => ({
        id: e._id.toString(),
        type: e.type,
        createdAt: e.createdAt.toISOString(),
      })),
      enrollment: enrollment
        ? { id: enrollment._id.toString(), status: enrollment.status }
        : null,
      earning: earning
        ? { id: earning._id.toString(), status: earning.status, netMinor: earning.netMinor }
        : null,
      refundable:
        !!enrollment &&
        enrollment.status !== "refunded" &&
        !!o.chargeId &&
        ["paid", "enrolled"].includes(o.status),
    }
  } catch (error) {
    console.error("Admin get order detail error:", error)
    return null
  }
}

export type AdminEarningRow = {
  id: string
  instructorName: string
  courseTitle: string
  kind: string
  netMinor: number
  status: string
  availableAt: string
  clearedAt: string | null
  createdAt: string
}

export async function adminListEarnings(filters?: {
  status?: string
  page?: number
}): Promise<{ earnings: AdminEarningRow[]; total: number; page: number; pageCount: number }> {
  const empty = { earnings: [], total: 0, page: 1, pageCount: 1 }
  try {
    await connectDB()
    await requireAdmin()

    const page = Math.max(1, filters?.page ?? 1)
    const query: Record<string, unknown> = {}
    if (filters?.status && filters.status !== "all") query.status = filters.status

    const [rows, total] = await Promise.all([
      Earning.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("instructor", "firstName lastName")
        .populate("course", "title")
        .lean(),
      Earning.countDocuments(query),
    ])

    return {
      earnings: rows.map((e) => {
        const instructor = e.instructor as unknown as { firstName?: string; lastName?: string } | null
        const course = e.course as unknown as { title?: string } | null
        return {
          id: e._id.toString(),
          instructorName: instructor
            ? `${instructor.firstName ?? ""} ${instructor.lastName ?? ""}`.trim() || "Unknown"
            : "Unknown",
          courseTitle: course?.title ?? "Course",
          kind: e.kind,
          netMinor: e.netMinor,
          status: e.status,
          availableAt: e.availableAt.toISOString(),
          clearedAt: e.clearedAt ? e.clearedAt.toISOString() : null,
          createdAt: e.createdAt.toISOString(),
        }
      }),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    }
  } catch (error) {
    console.error("Admin list earnings error:", error)
    return empty
  }
}

export type ReconcileFinding = {
  severity: "error" | "warning"
  message: string
}

/**
 * Report-only port of scripts/reconcile-orders.mjs — compares paid orders
 * against the wallet service's charge records. Healing stays in the script
 * (run `node scripts/reconcile-orders.mjs --heal` from ops) so the UI can
 * never mutate money state by accident.
 */
export async function adminRunReconciliation(): Promise<{
  success: boolean
  error?: string
  findings: ReconcileFinding[]
  checkedOrders: number
}> {
  try {
    await connectDB()
    await requireAdmin()

    if (!walletEnabled()) {
      return {
        success: false,
        error: "Wallet service is not configured (WALLET_BASE_URL / WALLET_SERVICE_TOKEN)",
        findings: [],
        checkedOrders: 0,
      }
    }

    const findings: ReconcileFinding[] = []
    // Transfer orders (ESPEE, bank, USDT) never touch the wallet (no chargeId
    // by design), so there is nothing to reconcile them against. Older orders
    // have no paymentMethod.
    const orders = await Order.find({
      status: { $in: ["paid", "enrolled", "refunded"] },
      paymentMethod: { $nin: [...TRANSFER_METHODS] },
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    for (const order of orders) {
      const label = `${order.reference}`
      if (!order.chargeId) {
        findings.push({ severity: "error", message: `${label}: status=${order.status} but has no chargeId` })
        continue
      }
      try {
        const charge = await getWalletCharge(order.authUserId, order.chargeId)
        if (charge.amountMinor !== order.amountMinor) {
          findings.push({
            severity: "error",
            message: `${label}: amount mismatch academy=${order.amountMinor} wallet=${charge.amountMinor}`,
          })
        }
        const enrollment = await Enrollment.findOne({ transactionId: order.chargeId }).lean()
        if (charge.status === "refunded" && enrollment && enrollment.status !== "refunded") {
          findings.push({
            severity: "error",
            message: `${label}: wallet charge refunded but enrollment still grants access — run reconcile --heal`,
          })
        }
        if (charge.status === "succeeded" && order.status === "paid" && !enrollment) {
          findings.push({
            severity: "warning",
            message: `${label}: charged but never enrolled (orphaned charge — refund or enroll)`,
          })
        }
      } catch {
        findings.push({ severity: "warning", message: `${label}: wallet lookup failed` })
      }
    }

    // Charged, but the order says "failed" (2026-11-08): the debit succeeded
    // and the save after it didn't, or the wallet completed it after our
    // timeout. The learner was told to retry, and a retry within 24h replays
    // the same charge and moves the order on, so a failed order still here
    // with a successful charge no seat holds means a learner paid for
    // nothing: refund the charge or enrol them. Declines moved no money.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const failedOrders = await Order.find({
      status: "failed",
      failureCode: { $ne: "insufficient_funds" },
      paymentMethod: { $nin: [...TRANSFER_METHODS] },
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
    const chargesByUser = new Map<string, UserChargeItem[] | null>()
    for (const order of failedOrders) {
      const label = `${order.reference}`
      let candidates: string[]
      if (order.chargeId) {
        try {
          const charge = await getWalletCharge(order.authUserId, order.chargeId)
          candidates = charge.status === "succeeded" ? [charge.id] : []
        } catch {
          findings.push({ severity: "warning", message: `${label}: failed order with a charge; wallet lookup failed` })
          continue
        }
      } else {
        // No charge id came back (a timeout): look for one by course and amount.
        let list = chargesByUser.get(order.authUserId)
        if (list === undefined) {
          list = await listUserCharges(order.authUserId, 50).catch(() => null)
          chargesByUser.set(order.authUserId, list)
        }
        if (list === null) {
          findings.push({ severity: "warning", message: `${label}: failed with an unknown outcome; wallet charge list unavailable` })
          continue
        }
        candidates = list
          .filter(
            (c) =>
              c.status === "succeeded" &&
              String(c.metadata?.courseId ?? "") === String(order.course) &&
              c.amountMinor === order.amountMinor
          )
          .map((c) => c.id)
      }
      for (const chargeId of candidates) {
        const [held, tracked] = await Promise.all([
          Enrollment.exists({ transactionId: chargeId }),
          Order.exists({ chargeId, status: { $in: ["paid", "enrolled", "refunded"] } }),
        ])
        if (held || tracked) continue
        findings.push({
          severity: "error",
          message: `${label}: marked failed, but wallet charge ${chargeId} succeeded and no enrollment holds it. The learner paid: refund the charge or enrol them.`,
        })
      }
    }

    // Paid enrollments without an order record
    const paidEnrollments = await Enrollment.find({
      pricePaid: { $gt: 0 },
      legacyUnpaid: { $ne: true },
      transactionId: { $nin: [null, ""] },
    })
      .limit(500)
      .lean()
    for (const e of paidEnrollments) {
      const order = await Order.findOne({ chargeId: e.transactionId }).lean()
      if (!order) {
        findings.push({
          severity: "warning",
          message: `enrollment ${e._id}: has charge ${e.transactionId} but no order record`,
        })
      }
    }

    return { success: true, findings, checkedOrders: orders.length + failedOrders.length }
  } catch (error) {
    console.error("Admin reconciliation error:", error)
    return { success: false, error: "Reconciliation failed", findings: [], checkedOrders: 0 }
  }
}
