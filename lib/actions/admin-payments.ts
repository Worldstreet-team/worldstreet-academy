"use server"

import connectDB from "@/lib/db"
import { Order, PaymentEvent, Enrollment, Earning } from "@/lib/db/models"
import { requireAdmin } from "@/lib/auth/admin"
import { getWalletCharge, walletEnabled } from "@/lib/wallet"

const PAGE_SIZE = 20

export type AdminOrderRow = {
  id: string
  reference: string
  status: string
  amountMinor: number
  currency: string
  chargeId: string | null
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
    const orders = await Order.find({ status: { $in: ["paid", "enrolled", "refunded"] } })
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

    return { success: true, findings, checkedOrders: orders.length }
  } catch (error) {
    console.error("Admin reconciliation error:", error)
    return { success: false, error: "Reconciliation failed", findings: [], checkedOrders: 0 }
  }
}
