import "server-only"

import { Course, ManualPayment, Order, type OrderStatus, type PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { isTransferMethod, type TransferMethod } from "@/lib/payment-channels"

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
  /** Not confirmed either way: the wallet didn't answer, or the order stalled mid-charge (2026-11-12). */
  | "unconfirmed"
  | "declined"
  | "cancelled"

export type MyPayment = {
  id: string
  courseId: string
  courseTitle: string
  /** The plan bought, e.g. "Standard"; null for a single-price course. */
  plan: string | null
  amountMinor: number
  method: "wallet" | TransferMethod
  status: MyPaymentStatus
  /** Why an admin declined a transfer proof. */
  note: string | null
  /** ISO — the last change. */
  at: string
  /** Where the row leads: the course once paid, the payment status page while in review, else the program page. */
  href: string | null
}

/** The newest this many of each kind. */
const LIMIT = 50

/** An order still "processing" after this long stalled mid-charge (a restart, a closed connection). */
const STALLED_AFTER_MS = 15 * 60 * 1000

/**
 * An order's state in a learner's words. A failed order that still carries a
 * charge id was charged, then the compensating refund failed: reconciliation
 * owes it back (lib/actions/enrollments.ts), so it reads as being refunded.
 * Only a decline proves no money moved (2026-11-12): after a timeout or a
 * wallet error the debit may have gone through, and the learner is never told
 * "you weren't charged" then.
 */
function orderStatus(
  status: OrderStatus,
  chargeId: string | null,
  failureCode: string | null,
  updatedAt: Date
): MyPaymentStatus {
  switch (status) {
    case "paid":
    case "enrolled":
      return "paid"
    case "pending":
    case "payment_requested":
      // return "processing" — 2026-11-12: a stalled order is unconfirmed, not "confirming" forever
      return Date.now() - updatedAt.getTime() > STALLED_AFTER_MS ? "unconfirmed" : "processing"
    case "refunded":
      return "refunded"
    case "cancelled":
      return "cancelled"
    case "failed":
      // return chargeId ? "refunding" : "failed" — 2026-11-12: only a decline reads "not charged"
      // (A failed transfer approval carries no failure code: its proof went back to review.)
      // return chargeId ? "refunding" : failureCode && failureCode !== "insufficient_funds" ? "unconfirmed" : "failed"
      // 2026-11-12: a charge looked for in the wallet and not found (NO_CHARGE_FOUND, set by
      // lib/actions/enrollments.ts) also proves nothing moved.
      return chargeId
        ? "refunding"
        : failureCode && failureCode !== "insufficient_funds" && failureCode !== "NO_CHARGE_FOUND"
          ? "unconfirmed"
          : "failed"
  }
}

/** "Upgrade from Basic to Executive" (2026-11-12): an upgrade order charges only the difference. */
function upgradeLabel(from: string | null, to: string | null): string {
  if (from && to) return `Upgrade from ${from} to ${to}`
  return to ? `Upgrade to ${to}` : "Plan upgrade"
}

export async function myPayments(userId: string): Promise<MyPayment[]> {
  const [orders, proofs] = await Promise.all([
    Order.find({ user: userId })
      .sort({ updatedAt: -1 })
      .limit(LIMIT)
      // .select("course packageKey amountMinor status chargeId failureCode paymentMethod updatedAt") — 2026-11-12: + an upgrade's kind and old plan
      .select("course packageKey amountMinor status chargeId failureCode paymentMethod updatedAt kind fromPackageKey")
      .lean(),
    ManualPayment.find({ user: userId, status: { $in: ["submitted", "rejected"] } })
      .sort({ updatedAt: -1 })
      .limit(LIMIT)
      .select("course packageKey packageName amountMinor method status rejectionReason updatedAt")
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
      const status = orderStatus(o.status, o.chargeId ?? null, o.failureCode ?? null, o.updatedAt)
      return {
        id: o._id.toString(),
        courseId,
        courseTitle: titleOf(courseId),
        // plan: planOf(o.packageKey), — 2026-11-12: a plan upgrade says so, and from which plan
        plan: o.kind === "upgrade" ? upgradeLabel(planOf(o.fromPackageKey), planOf(o.packageKey)) : planOf(o.packageKey),
        amountMinor: o.amountMinor,
        method: isTransferMethod(o.paymentMethod) ? o.paymentMethod : "wallet",
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
        method: p.method ?? "espee",
        status,
        note: p.status === "rejected" ? (p.rejectionReason ?? null) : null,
        at: p.updatedAt.toISOString(),
        href: hrefOf(courseId, status),
      }
    }),
  ]
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT)
}
