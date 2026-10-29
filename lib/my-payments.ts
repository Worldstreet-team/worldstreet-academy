import "server-only"

import { Course, ManualPayment, Order, type OrderStatus, type PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL } from "@/lib/entitlements"

/**
 * A learner's own purchases (corrections brief §6–§7, 2026-10-28: payment
 * status in the student portal). Read-only: every order (wallet charges and
 * approved ESPEE payments) plus the ESPEE proofs still waiting for an admin or
 * declined (an approved proof is already an order). Amounts are integer US
 * cents. Admins see the same money at /admin/payments.
 */

export type MyPaymentStatus =
  | "paid"
  | "processing"
  | "in_review"
  | "refunding"
  | "refunded"
  | "failed"
  | "declined"
  | "cancelled"

export type MyPayment = {
  id: string
  courseId: string
  courseTitle: string
  /** The plan bought, e.g. "Standard"; null for a single-price course. */
  plan: string | null
  amountMinor: number
  method: "wallet" | "espee"
  status: MyPaymentStatus
  /** Why an admin declined an ESPEE proof. */
  note: string | null
  /** ISO — the last change. */
  at: string
  /** Where the row leads: the course once paid, the ESPEE status page while in review, else the program page. */
  href: string | null
}

/** The newest this many of each kind. */
const LIMIT = 50

/**
 * An order's state in a learner's words. A failed order that still carries a
 * charge id was charged, then the compensating refund failed: reconciliation
 * owes it back (lib/actions/enrollments.ts), so it reads as being refunded.
 */
function orderStatus(status: OrderStatus, chargeId: string | null): MyPaymentStatus {
  switch (status) {
    case "paid":
    case "enrolled":
      return "paid"
    case "pending":
    case "payment_requested":
      return "processing"
    case "refunded":
      return "refunded"
    case "cancelled":
      return "cancelled"
    case "failed":
      return chargeId ? "refunding" : "failed"
  }
}

export async function myPayments(userId: string): Promise<MyPayment[]> {
  const [orders, proofs] = await Promise.all([
    Order.find({ user: userId })
      .sort({ updatedAt: -1 })
      .limit(LIMIT)
      .select("course packageKey amountMinor status chargeId paymentMethod updatedAt")
      .lean(),
    ManualPayment.find({ user: userId, status: { $in: ["submitted", "rejected"] } })
      .sort({ updatedAt: -1 })
      .limit(LIMIT)
      .select("course packageKey packageName amountMinor status rejectionReason updatedAt")
      .lean(),
  ])

  const courseIds = [...new Set([...orders, ...proofs].map((row) => row.course.toString()))]
  const courses = courseIds.length > 0 ? await Course.find({ _id: { $in: courseIds } }).select("title slug").lean() : []
  const courseOf = new Map(courses.map((c) => [c._id.toString(), c]))
  const titleOf = (id: string) => courseOf.get(id)?.title ?? "A course no longer listed"
  const planOf = (key: PackageKey | null | undefined) => (key ? PACKAGE_LABEL[key] : null)
  const hrefOf = (id: string, status: MyPaymentStatus) => {
    if (status === "paid") return `/dashboard/courses/${id}`
    if (status === "in_review") return "/dashboard/checkout/pending"
    const slug = courseOf.get(id)?.slug
    return slug ? `/programs/${slug}` : null
  }

  const rows: MyPayment[] = [
    ...orders.map((o): MyPayment => {
      const courseId = o.course.toString()
      const status = orderStatus(o.status, o.chargeId ?? null)
      return {
        id: o._id.toString(),
        courseId,
        courseTitle: titleOf(courseId),
        plan: planOf(o.packageKey),
        amountMinor: o.amountMinor,
        method: o.paymentMethod === "espee" ? "espee" : "wallet",
        status,
        note: null,
        at: o.updatedAt.toISOString(),
        href: hrefOf(courseId, status),
      }
    }),
    ...proofs.map((p): MyPayment => {
      const courseId = p.course.toString()
      const status: MyPaymentStatus = p.status === "submitted" ? "in_review" : "declined"
      return {
        id: p._id.toString(),
        courseId,
        courseTitle: titleOf(courseId),
        plan: p.packageName ?? planOf(p.packageKey),
        amountMinor: p.amountMinor,
        method: "espee",
        status,
        note: p.status === "rejected" ? (p.rejectionReason ?? null) : null,
        at: p.updatedAt.toISOString(),
        href: hrefOf(courseId, status),
      }
    }),
  ]
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT)
}
