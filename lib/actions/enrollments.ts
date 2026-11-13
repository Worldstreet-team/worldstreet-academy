"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import {
  Course,
  Enrollment,
  User,
  Lesson,
  Order,
  PaymentEvent,
  Earning,
  EARNINGS_CLEARING_DAYS,
  type CourseKind,
  type ICoursePackage,
  type IOrder,
  type OrderStatus,
  type PackageKey,
} from "@/lib/db/models"
import { Types } from "mongoose"
import { getCurrentUser } from "@/lib/auth/actions"
import { courseAvailability } from "@/lib/types/course"
import { sendEnrollmentConfirmationEmail } from "@/lib/email"
import { sendWelcomeOnce } from "@/lib/welcome-email"
import { notifyAdmins, notifyUser, notifyUsers } from "@/lib/notify"
import { getCourseAccess, isLessonLockedFor, lockedLessonIds, openPublishedLessonIds } from "@/lib/course-access"
import { courseTeacherIds } from "@/lib/teaching"
import { ensureCertificateId, saveWithCertificateId } from "@/lib/certificate-id"
import { ensureCertificateTier } from "@/lib/certificate-standing"
import { POINTS, awardPoints, pointKey } from "@/lib/points"
import { PACKAGE_KEYS, PACKAGE_LABEL, PACKAGE_RANK, isOnSale, packageFor, sellsPackages } from "@/lib/entitlements"
import { courseKindOf } from "@/lib/course-kind"
import { kindIsOpen } from "@/lib/marketplace"
import {
  bookReferralCommission,
  referralCookieCode,
  sellerLinkCookieCode,
  referrerFor,
  splitSale,
  type Referrer,
} from "@/lib/referrals"
import {
  createWalletCharge,
  listUserCharges,
  refundWalletCharge,
  isInsufficientBalance,
  walletEnabled,
  WalletError,
  type UserChargeItem,
  type WalletCharge,
} from "@/lib/wallet"

// ============================================================================
// TYPES
// ============================================================================

export type EnrollmentWithCourse = {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  instructorName: string
  progress: number
  completedLessons: string[]
  lastAccessedAt: string
  status: string
}

export type EnrollmentProgress = {
  progress: number
  completedLessons: string[]
  totalLessons: number
  lastAccessedLesson: string | null
}

// ============================================================================
// ENROLLMENT ACTIONS
// ============================================================================

export type PurchaseResult =
  | { success: true; data: { enrollmentId: string; alreadyEnrolled?: boolean; packageName: string | null } }
  | {
      success: false
      error: string
      code?:
        | "auth"
        | "invalid"
        | "not_found"
        | "not_live"
        | "package_required"
        | "insufficient_funds"
        | "wallet_unavailable"
        | "enroll_failed"
        | "on_hold"
        | "price_changed"
      shortfallMinor?: number
      availableMinor?: number
    }

const PurchaseInput = z.object({
  courseId: z.string().regex(/^[a-f0-9]{24}$/),
  packageKey: z.enum(PACKAGE_KEYS).optional(),
  // The amount checkout showed, in cents (2026-11-12). Optional, so an older open tab still pays.
  expectedMinor: z.number().int().nonnegative().optional(),
})

async function transitionOrder(order: IOrder, status: OrderStatus, note?: string) {
  order.status = status
  order.history.push({ status, at: new Date(), ...(note ? { note } : {}) })
  await order.save()
}

async function logPaymentEvent(
  orderId: Types.ObjectId | null,
  reference: string,
  type: string,
  payload: Record<string, unknown>
) {
  try {
    await PaymentEvent.create({ order: orderId, reference, type, payload })
  } catch (err) {
    console.error("[Payments] failed to log payment event", type, err)
  }
}

// ============================================================================
// AN EARLIER CHARGE WHOSE OUTCOME WAS UNKNOWN (2026-11-12, Owen)
// ============================================================================
//
// A retry replays its order's idempotency key, so the wallet hands back the
// first attempt's charge instead of taking a second one — but only for 24
// hours, after which it forgets the key and would charge again. So before an
// order whose earlier attempt may have taken money is charged again, its
// charge is looked for in the learner's wallet history: found, it is adopted
// as this order's payment and nothing new is charged.

/** The wallet replays a key's stored answer for 24 hours; an hour short of that, to be safe. */
const KEY_REPLAY_WINDOW_MS = 23 * 60 * 60 * 1000
/** A charge stamped a little before its order (clocks differ) still belongs to it. */
const CHARGE_CLOCK_SKEW_MS = 5 * 60 * 1000
/** How much of the learner's wallet history is read. A full page that doesn't reach back to the order proves nothing. */
const CHARGE_LIST_LIMIT = 100
/** An attempt younger than this may still be with the wallet. */
const CHARGE_IN_FLIGHT_MS = 5 * 60 * 1000
/** failureCode of an order whose charge was looked for and is not in the wallet: no money moved. */
const NO_CHARGE_FOUND = "NO_CHARGE_FOUND"

/** The part of a confirmed charge the payment paths read. */
type ConfirmedCharge = Pick<WalletCharge, "id" | "status" | "amountMinor">

/**
 * Whether this order's earlier attempt may have taken money. Only a decline,
 * a recorded refusal or a charge looked for and not found prove it didn't.
 */
async function mayHoldCharge(order: IOrder): Promise<boolean> {
  switch (order.status) {
    case "payment_requested":
    case "paid":
      return true
    case "failed": {
      if (order.failureCode === "insufficient_funds" || order.failureCode === NO_CHARGE_FOUND) return false
      // Charged, then the compensating refund failed.
      if (order.chargeId) return true
      const last = await PaymentEvent.findOne({ order: order._id, type: "charge_failed" })
        .sort({ createdAt: -1 })
        .select("payload")
        .lean()
      // No record reads as unknown: fail safe.
      return last?.payload?.outcomeUnknown !== false
    }
    default:
      return false
  }
}

/** A charge another order, or any enrollment, already holds. */
async function chargeIsHeld(chargeId: string, orderId: Types.ObjectId): Promise<boolean> {
  const [onOrder, onEnrollment] = await Promise.all([
    Order.exists({ chargeId, _id: { $ne: orderId } }),
    Enrollment.exists({ transactionId: chargeId }),
  ])
  return Boolean(onOrder || onEnrollment)
}

type EarlierCharge =
  | { kind: "found"; charge: ConfirmedCharge; matchedBy: "charge_id" | "reference" | "course_amount" }
  | { kind: "refunded"; chargeId: string }
  | { kind: "none" }
  | { kind: "unavailable"; reason: string }

/**
 * Looks for `order`'s charge in the learner's wallet history. A charge made
 * since 2026-11-12 carries its idempotency key as `metadata.reference` and
 * matches on it exactly. An older one (purchases only) matches on course,
 * plan and amount, made no earlier than the order, held by no other order or
 * enrollment, and only when exactly one does. "unavailable" when the history
 * can't be read or can't settle it.
 */
async function findEarlierCharge(authUserId: string, order: IOrder): Promise<EarlierCharge> {
  let charges: UserChargeItem[]
  try {
    charges = await listUserCharges(authUserId, CHARGE_LIST_LIMIT)
  } catch (err) {
    return { kind: "unavailable", reason: err instanceof WalletError ? err.code : "WALLET_ERROR" }
  }
  if (!Array.isArray(charges)) return { kind: "unavailable", reason: "malformed" }

  const since = order.createdAt.getTime() - CHARGE_CLOCK_SKEW_MS
  if (charges.length >= CHARGE_LIST_LIMIT) {
    const times = charges.map((c) => Date.parse(c.createdAt)).filter((t) => Number.isFinite(t))
    if (times.length === 0 || Math.min(...times) > since) return { kind: "unavailable", reason: "list_truncated" }
  }

  const referenceOf = (c: UserChargeItem) => (typeof c.metadata?.reference === "string" ? c.metadata.reference : null)
  const exact = charges.filter((c) => (order.chargeId && c.id === order.chargeId) || referenceOf(c) === order.reference)
  const paid = exact.find((c) => c.status === "succeeded")
  if (paid) {
    if (await chargeIsHeld(paid.id, order._id)) return { kind: "unavailable", reason: "held" }
    return {
      kind: "found",
      charge: { id: paid.id, status: "succeeded", amountMinor: paid.amountMinor },
      matchedBy: order.chargeId && paid.id === order.chargeId ? "charge_id" : "reference",
    }
  }
  const refunded = exact.find((c) => c.status === "refunded")
  if (refunded) return { kind: "refunded", chargeId: refunded.id }
  // The order holds a confirmed charge the history doesn't show: can't settle it.
  if (order.chargeId) return { kind: "unavailable", reason: "charge_missing" }
  // Upgrades always carry their reference; only a purchase can predate it.
  if (order.kind === "upgrade") return { kind: "none" }

  const loose: UserChargeItem[] = []
  for (const c of charges) {
    if (c.status !== "succeeded" || referenceOf(c) !== null) continue
    if (String(c.metadata?.courseId ?? "") !== String(order.course)) continue
    const chargedKey = typeof c.metadata?.packageKey === "string" ? c.metadata.packageKey : null
    if (chargedKey !== (order.packageKey ?? null)) continue
    if (c.amountMinor !== order.amountMinor) continue
    const at = Date.parse(c.createdAt)
    if (!Number.isFinite(at) || at < since) continue
    if (await chargeIsHeld(c.id, order._id)) continue
    loose.push(c)
  }
  if (loose.length > 1) return { kind: "unavailable", reason: "ambiguous" }
  if (loose.length === 1) {
    return { kind: "found", charge: { id: loose[0].id, status: "succeeded", amountMinor: loose[0].amountMinor }, matchedBy: "course_amount" }
  }
  return { kind: "none" }
}

type PriorAttempt =
  /** Charge as before, with this order's key. */
  | { action: "charge" }
  /** The earlier attempt's charge went through: it is this order's payment. */
  | { action: "adopt"; charge: ConfirmedCharge; matchedBy: string }
  /** The earlier attempt's charge was refunded: this key must not be replayed. */
  | { action: "refunded"; chargeId: string }
  /** Can't tell whether the earlier attempt took money: nothing is charged. */
  | { action: "refuse"; error: string; reason: string }

/** Refusal copy when an earlier payment can't be confirmed either way. Never says "not charged". */
const STILL_CONFIRMING =
  "We're still confirming your earlier payment. Try again in a few minutes, or contact support if it doesn't clear."

/**
 * What to do about this order's earlier attempt before charging (2026-11-12).
 * A new order, or one whose earlier attempt provably moved no money, is
 * charged as before. Otherwise its charge is looked for: found, it is adopted
 * when it is for today's amount (a different amount goes to support — the
 * learner was charged, so reconciliation shows it); not found, it is charged
 * as before. When the history can't be read, the wallet still replays the key
 * within 24 hours, so the charge goes ahead; after that it is refused.
 */
async function settlePriorAttempt(order: IOrder, authUserId: string, amountMinor: number): Promise<PriorAttempt> {
  if (!(await mayHoldCharge(order))) return { action: "charge" }
  const earlier = await findEarlierCharge(authUserId, order)
  switch (earlier.kind) {
    case "found":
      if (earlier.charge.amountMinor === amountMinor) {
        return { action: "adopt", charge: earlier.charge, matchedBy: earlier.matchedBy }
      }
      return {
        action: "refuse",
        reason: "amount_differs",
        error:
          "We found an earlier payment for this order, but its amount differs from today's price. Contact support and we'll sort it out.",
      }
    case "refunded":
      return { action: "refunded", chargeId: earlier.chargeId }
    case "none":
      return { action: "charge" }
    case "unavailable":
      return Date.now() - order.createdAt.getTime() < KEY_REPLAY_WINDOW_MS
        ? { action: "charge" }
        : { action: "refuse", reason: earlier.reason, error: STILL_CONFIRMING }
  }
}

/**
 * Purchase / enroll in a course, in one of its packages when it sells them.
 *
 * The caller supplies only the course and the package key: identity comes
 * from the session and the price from the course record (the chosen enabled
 * package's price, or the single course price when the course sells no
 * packages) — nothing money-related is trusted from the client. Paid purchases
 * debit the central Worldstreet wallet server-to-server and enroll ONLY after
 * the wallet confirms the charge. The debit is idempotent (deterministic
 * reference per user + course + package + purchase generation), so a retried
 * or double-clicked purchase can never charge twice. If the wallet is
 * unreachable we fail closed: no enrollment, no fake success.
 */
export async function purchaseCourse(input: {
  courseId: string
  packageKey?: PackageKey
  expectedMinor?: number
}): Promise<PurchaseResult> {
  try {
    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "You need to be signed in to enroll", code: "auth" }
    }

    const parsed = PurchaseInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: "That checkout link isn't valid", code: "invalid" }
    }
    const { courseId, packageKey, expectedMinor } = parsed.data

    // Idempotent short-circuit — an existing access-granting enrollment is a
    // success, not an error. A refunded row means this is a RE-purchase: the
    // row is kept for audit, so we reactivate it rather than insert (the
    // {user, course} unique index forbids a second row).
    const existing = await Enrollment.findOne({ user: user.id, course: courseId })
    // An admin's own decision on this enrollment outranks a purchase, as it does
    // a transfer approval or an access grant (2026-11-12). It used to come back
    // as "already enrolled": the learner saw "Payment confirmed" with nothing
    // charged and no access. Nothing has been charged at this point.
    if (existing && ["suspended", "cancelled", "expired"].includes(existing.status)) {
      return {
        success: false,
        error: "Your place on this program is on hold, so it can't be bought here. Contact support and we'll sort it out. You have not been charged.",
        code: "on_hold",
      }
    }
    // A pre-enrolled row is a reservation, not access: purchase ACTIVATES it.
    const isActivation = existing?.status === "pre_enrolled"
    if (existing && existing.status !== "refunded" && !isActivation) {
      return {
        success: true,
        data: {
          enrollmentId: existing._id.toString(),
          alreadyEnrolled: true,
          packageName: existing.packageName ?? null,
        },
      }
    }
    const isRepurchase = Boolean(existing) && !isActivation

    const course = await Course.findOne({ _id: courseId, status: "published" })
    if (!course) {
      return { success: false, error: "Course not found or not available", code: "not_found" }
    }
    // The marketplace is Coming soon (MARKETPLACE_OPEN): it sells nothing.
    if (!kindIsOpen(course.kind)) {
      return { success: false, error: "The marketplace opens soon.", code: "not_found" }
    }

    // Scheduled courses take money only once they are live — before that the
    // only door is preEnrollCourse, which never charges.
    if (courseAvailability(course) === "coming_soon") {
      return {
        success: false,
        error: "This course isn't live yet. You can enroll now and pay when it launches.",
        code: "not_live",
      }
    }

    // Which package is being bought. A course that sells packages takes money
    // only for an enabled tier the buyer chose. A course with no enabled
    // package sells at its single price and ignores any key — the program page
    // links its synthesized "Full program" tier as package=standard.
    const packaged = sellsPackages(course)
    const pkg = packaged ? packageFor(course, packageKey ?? null) : null
    if (packaged && !pkg) {
      return { success: false, error: "Choose a plan to continue", code: "package_required" }
    }

    const price = pkg ? pkg.price : course.pricing === "paid" ? course.price ?? 0 : 0
    const amountMinor = Math.round(price * 100)
    const isPaid = amountMinor > 0
    // No course is free (isOnSale): nothing enrols without a charge.
    if (!isPaid) {
      return { success: false, error: "This course isn't on sale.", code: "not_found" }
    }
    // The price changed after checkout loaded (a catalogue update, 2026-11-12):
    // never charge a figure the learner wasn't shown. Nothing is written yet.
    if (expectedMinor !== undefined && expectedMinor !== amountMinor) {
      return {
        success: false,
        error: "The price of this plan changed since you opened this page. Check the new price, then pay. You have not been charged.",
        code: "price_changed",
      }
    }
    const packageFields = { packageKey: pkg?.key ?? null, packageName: pkg?.name ?? null }

    // The charge reference is deterministic per PURCHASE GENERATION, not per
    // user+course. Within one generation, retries and double-clicks replay the
    // same charge (never a second debit). But a re-purchase after a refund must
    // get a fresh reference: the wallet replays a stored idempotent response for
    // 24h, so reusing the old key would hand back the already-refunded charge
    // and the student would get the course without paying again.
    // 2026-11-12: plan upgrades are orders on the same user + course with keys of
    // their own; they never count here, so purchase keys stay exactly as before.
    const generation = await Order.countDocuments({
      user: user.id,
      course: courseId,
      status: "refunded",
      kind: { $ne: "upgrade" },
    })
    // Package purchases carry the key; single-price references stay
    // byte-identical to pre-package orders so their retries still replay.
    const baseReference = `academy_enroll_${user.id}_${courseId}${pkg ? `_${pkg.key}` : ""}`
    // A declined charge moved no money, so the next try gets a fresh key
    // (2026-11-08). The wallet replays a stored response for 24h; were it to
    // replay a decline, a learner who has since topped up would stay declined
    // for a day. Only "insufficient balance" counts: any other failure may
    // have taken the money, so its retry must replay the same key.
    const declines = await Order.countDocuments({
      user: user.id,
      course: courseId,
      status: "failed",
      failureCode: "insufficient_funds",
      kind: { $ne: "upgrade" },
    })
    const reference = `${baseReference}${generation > 0 ? `_r${generation}` : ""}${declines > 0 ? `_d${declines}` : ""}`

    let chargeId: string | null = null
    let order: IOrder | null = null

    if (isPaid) {
      if (!walletEnabled()) {
        // Never enroll a paid course without a confirmed debit.
        return {
          success: false,
          error: "Payments are temporarily unavailable. Please try again later.",
          code: "wallet_unavailable",
        }
      }

      const ord = await Order.findOneAndUpdate(
        { reference },
        {
          $setOnInsert: {
            user: user.id,
            authUserId: user.authUserId,
            course: courseId,
            reference,
            amountMinor,
            currency: "USD",
            packageKey: packageFields.packageKey,
            status: "pending",
            history: [{ status: "pending", at: new Date() }],
          },
        },
        { upsert: true, new: true }
      )
      if (!ord) {
        return { success: false, error: "Failed to open an order", code: "enroll_failed" }
      }
      order = ord

      // 2026-11-12: an earlier attempt of this order may have taken the money
      // (a timeout, a wallet error, a stall). Its charge is looked for before
      // this key is charged again: after 24 hours the wallet no longer
      // replays the key and would take a second payment.
      const prior = await settlePriorAttempt(ord, user.authUserId, amountMinor)
      if (prior.action === "refuse") {
        await logPaymentEvent(ord._id, reference, "charge_deferred", { reason: prior.reason })
        console.error("[Payments] earlier attempt unconfirmed, not charging again:", reference, prior.reason)
        return { success: false, error: prior.error, code: "wallet_unavailable" }
      }
      if (prior.action === "refunded") {
        // Replaying this key would hand back that refunded charge. This order IS
        // that charge, so it is marked refunded and the next try gets a fresh key.
        ord.chargeId = prior.chargeId
        await transitionOrder(ord, "refunded", "its charge was refunded in the wallet — the next try gets a fresh key")
        await logPaymentEvent(ord._id, reference, "charge_replayed_refunded", { chargeId: prior.chargeId, via: "history" })
        return {
          success: false,
          error: "Your earlier payment for this program was refunded, so it can't open it again. Tap Pay once more to make a new payment.",
          code: "wallet_unavailable",
        }
      }

      await transitionOrder(ord, "payment_requested")
      await logPaymentEvent(ord._id, reference, "charge_requested", {
        amountMinor,
        courseId,
        packageKey: packageFields.packageKey,
        authUserId: user.authUserId,
      })

      // let charge: WalletCharge — 2026-11-12: an adopted earlier charge carries only these fields.
      let charge: ConfirmedCharge
      try {
        if (prior.action === "adopt") {
          charge = prior.charge
          await logPaymentEvent(ord._id, reference, "charge_adopted", {
            chargeId: prior.charge.id,
            amountMinor: prior.charge.amountMinor,
            matchedBy: prior.matchedBy,
          })
        } else {
          ;({ charge } = await createWalletCharge(user.authUserId, {
            amountMinor,
            description: pkg ? `Course: ${course.title} — ${pkg.name}` : `Course: ${course.title}`,
            metadata: {
              // 2026-11-12: the idempotency key, so a later retry finds this charge exactly.
              reference,
              courseId: course._id.toString(),
              courseSlug: course.slug ?? "",
              ...(packageFields.packageKey ? { packageKey: packageFields.packageKey } : {}),
            },
            idempotencyKey: reference,
          }))
        }
      } catch (err) {
        if (isInsufficientBalance(err)) {
          const details = err.details as { availableMinor?: number }
          const availableMinor = typeof details.availableMinor === "number" ? details.availableMinor : 0
          ord.failureCode = "insufficient_funds"
          await transitionOrder(ord, "failed", "insufficient funds")
          await logPaymentEvent(ord._id, reference, "charge_failed", {
            code: "INSUFFICIENT_BALANCE",
            availableMinor,
          })
          return {
            success: false,
            error: "Your Worldstreet balance doesn't cover this purchase.",
            code: "insufficient_funds",
            availableMinor,
            shortfallMinor: Math.max(0, amountMinor - availableMinor),
          }
        }
        const code = err instanceof WalletError ? err.code : "WALLET_ERROR"
        // Only a refusal from the wallet proves no money moved. After a timeout,
        // a dropped connection (WALLET_UNAVAILABLE) or a wallet-side error, the
        // debit may have completed after we gave up: the learner must never be
        // told "not charged" then. A retry replays this same key, so it can't
        // charge twice, and reconciliation reports a charge no order holds.
        const outcomeUnknown = !(err instanceof WalletError) || code === "WALLET_UNAVAILABLE" || err.status >= 500
        ord.failureCode = code
        await transitionOrder(ord, "failed", code)
        await logPaymentEvent(ord._id, reference, "charge_failed", {
          code,
          outcomeUnknown,
          message: err instanceof Error ? err.message : String(err),
        })
        console.error("[Payments] wallet charge failed:", err)
        return {
          success: false,
          error: outcomeUnknown
            ? "We couldn't confirm your payment with your WorldStreet wallet. Please try again: you won't be charged twice. If your balance went down and you still can't get in, contact support."
            : "Your WorldStreet wallet couldn't take this payment. You have not been charged.",
          code: "wallet_unavailable",
        }
      }

      // An answer with no charge in it confirms nothing (2026-11-12). It may
      // still have taken the money, so the learner is never told "not
      // charged": a retry replays this same key.
      if (!charge?.id) {
        ord.failureCode = "CHARGE_UNCONFIRMED"
        await transitionOrder(ord, "failed", "the wallet answered without a charge")
        await logPaymentEvent(ord._id, reference, "charge_failed", { code: "CHARGE_UNCONFIRMED", outcomeUnknown: true })
        console.error("[Payments] wallet answered without a charge:", reference)
        return {
          success: false,
          error:
            "We couldn't confirm your payment with your WorldStreet wallet. Please try again: you won't be charged twice. If your balance went down and you still can't get in, contact support.",
          code: "wallet_unavailable",
        }
      }
      // A replayed charge that was already refunded is no payment (2026-11-12).
      // The wallet replays a key's stored answer, so a re-purchase whose earlier
      // order was never marked refunded (the refund's own save failed) carries
      // the refunded charge's key and gets that charge back. Never open a seat on
      // it: this order IS that refunded charge, so it is marked refunded, and the
      // learner's next try counts it and carries a fresh key.
      const replayedRefund =
        charge.status === "refunded" ||
        (isRepurchase && Boolean(existing?.transactionId) && charge.id === existing?.transactionId)
      if (replayedRefund) {
        ord.chargeId = charge.id
        await transitionOrder(ord, "refunded", "the wallet replayed a refunded charge — the next try gets a fresh key")
        await logPaymentEvent(ord._id, reference, "charge_replayed_refunded", { chargeId: charge.id })
        console.error("[Payments] wallet replayed a refunded charge, no seat opened:", reference, charge.id)
        return {
          success: false,
          error: "Your earlier payment for this program was refunded, so it can't open it again. Tap Pay once more to make a new payment.",
          code: "wallet_unavailable",
        }
      }

      // The debit is confirmed. A failed save here must not turn it into a
      // "failed" order that tells the learner nothing moved: enrolment below
      // still runs, and if that fails too its handler refunds this charge.
      chargeId = charge.id
      ord.chargeId = charge.id
      try {
        await transitionOrder(ord, "paid")
      } catch (err) {
        console.error("[Payments] charge confirmed but the order didn't save — enrolling anyway:", charge.id, err)
      }
      await logPaymentEvent(ord._id, reference, "charge_confirmed", {
        chargeId: charge.id,
        amountMinor: charge.amountMinor,
      })
    }

    // Create (or reactivate) the enrollment — access unlocks here and never
    // before payment.
    let enrollment
    try {
      if (isRepurchase || isActivation) {
        // Restore (re-purchase) or activate (pre-enrollment) the audited row.
        // Progress is deliberately preserved either way. The filter pins the
        // status we read, so a concurrent purchase that already took the row
        // is detected below instead of silently overwritten.
        enrollment = await Enrollment.findOneAndUpdate(
          { user: user.id, course: courseId, status: isActivation ? "pre_enrolled" : "refunded" },
          {
            $set: {
              status: "active",
              pricePaid: price,
              currency: "USD",
              transactionId: chargeId,
              purchasedAt: new Date(),
              activatedAt: new Date(),
              legacyUnpaid: false,
              ...packageFields,
            },
          },
          { new: true }
        )
        if (!enrollment) {
          throw Object.assign(new Error("enrollment row changed concurrently"), { code: 11000 })
        }
        // The kept completed lessons now count against this purchase's plan,
        // which may open more lessons (or fewer) than the old one did — as an
        // admin plan change does (adminSetEnrollmentPackage). The seat is held
        // by now, so a failure here is logged and never reaches the handler
        // below (2026-11-12): it would return early, and this sale's earning and
        // commission would never be written.
        try {
          const reopened = await getCourseAccess(user.id, courseId)
          if (reopened) {
            const open = await openPublishedLessonIds(reopened)
            const done = enrollment.completedLessons.filter((id: Types.ObjectId) => open.has(id.toString())).length
            const progress = open.size > 0 ? Math.min(100, Math.round((done / open.size) * 100)) : 0
            if (progress !== enrollment.progress) {
              enrollment = (await Enrollment.findByIdAndUpdate(enrollment._id, { $set: { progress } }, { new: true })) ?? enrollment
            }
          }
        } catch (err) {
          console.error("[Payments] seat restored, but its progress didn't recount:", err)
        }
      } else {
        enrollment = await Enrollment.create({
          user: user.id,
          course: courseId,
          pricePaid: price,
          currency: "USD",
          transactionId: chargeId,
          purchasedAt: new Date(),
          activatedAt: new Date(),
          ...packageFields,
        })
      }
    } catch (err: unknown) {
      // Whatever went wrong, first ask whether an access-granting row already
      // holds THIS request's charge — a same-reference sibling, or our own
      // write, may have committed even though this call errored. Refunding that
      // charge would leave access on a refunded debit.
      const winner = await Enrollment.findOne({
        user: user.id,
        course: courseId,
        status: { $in: ["active", "completed"] },
      }).catch(() => null)
      // Raced with another request for the same user+course. Same package →
      // same reference → the wallet replayed ONE charge, so the winner holds our
      // charge (or nobody charged) and there is nothing to undo.
      if (winner && (!chargeId || winner.transactionId === chargeId)) {
        if (order) await transitionOrder(order, "enrolled", "concurrent enrollment")
        return {
          success: true,
          data: { enrollmentId: winner._id.toString(), alreadyEnrolled: true, packageName: winner.packageName ?? null },
        }
      }
      // Charged, but THIS charge bought no access (enrollment failed, or a
      // concurrent purchase of a different package took the row) — refund so no
      // money is kept without access. If the refund also fails, the
      // reconciliation job surfaces it.
      if (isPaid && chargeId) {
        try {
          await refundWalletCharge(
            user.authUserId,
            chargeId,
            winner ? "lost a concurrent purchase" : "enrollment creation failed"
          )
          if (order) {
            await transitionOrder(
              order,
              "refunded",
              winner
                ? "compensating refund — a concurrent purchase took the enrollment"
                : "compensating refund after enroll failure"
            )
            await logPaymentEvent(order._id, reference, "charge_refunded", { chargeId })
          }
        } catch (refundErr) {
          console.error("[Payments] ORPHANED CHARGE — refund failed, needs reconciliation:", chargeId, refundErr)
          if (order) {
            await transitionOrder(order, "failed", "enroll failed AND refund failed — orphaned charge")
            await logPaymentEvent(order._id, reference, "refund_failed", { chargeId })
          }
        }
      }
      if (winner) {
        return {
          success: true,
          data: { enrollmentId: winner._id.toString(), alreadyEnrolled: true, packageName: winner.packageName ?? null },
        }
      }
      console.error("Enroll in course error:", err)
      return { success: false, error: "Failed to enroll in course", code: "enroll_failed" }
    }

    // The learner has paid and holds the seat (2026-11-08). Nothing below may
    // turn that into "Failed to enroll": a retry would only stop at "already
    // enrolled", and the earning and commission below would never be written.
    // Each step is guarded on its own, so one failure can't skip the next.
    if (order) {
      await transitionOrder(order, "enrolled").catch((err) =>
        console.error("[Payments] enrolled, but the order status didn't save:", order?.reference, err)
      )
    }

    // Who made the sale (owner, 2026-10-05): the code in the buyer's `wsa_ref`
    // cookie, else whoever their account says invited them. It sets the
    // seller's share and whether a referral commission is owed (the truth
    // table is `splitSale` in lib/referrals.ts). The money has already moved,
    // so nothing here may fail the purchase: on any error it is logged and the
    // sale is booked as the Academy's, with no code.
    const courseKind = courseKindOf(course)
    const sellerId = course.instructor.toString()
    const academySale = splitSale({ kind: courseKind, sellerId, buyerId: user.id, referrer: null })
    let split = academySale
    let referrer: Referrer | null = null
    if (isPaid && order) {
      try {
        // A seller's own link to this very course beats an older first-touch
        // code (SELLER_LINK_COOKIE); anything else follows the usual order.
        const sellerCode = courseKind === "marketplace" ? await sellerLinkCookieCode(course.slug) : null
        const sellerRef = sellerCode ? await referrerFor(user.id, sellerCode) : null
        referrer =
          sellerRef && sellerRef.userId === sellerId && sellerRef.source === "link"
            ? sellerRef
            : await referrerFor(user.id, await referralCookieCode())
        split = splitSale({ kind: courseKind, sellerId, buyerId: user.id, referrer })
        if (split.attribution) {
          await Order.updateOne({ _id: order._id }, { $set: { attribution: split.attribution } })
        }
      } catch (err) {
        console.error("[Referrals] attribution failed — booked as an Academy sale:", err)
        referrer = null
        split = academySale
      }
      // A link they arrived through also answers "Who invited you?" for an
      // account that has no answer yet (first answer wins).
      if (referrer?.source === "link") {
        const { code, userId } = referrer
        await User.updateOne(
          { _id: user.id, referredBy: null },
          { $set: { referredBy: { text: code, at: new Date(), code, userId } } }
        ).catch((err) => console.error("[Referrals] failed to save who invited the buyer:", err))
      }
    }

    // Instructor earnings: ledger row stays pending through the clearing
    // window, then clears into their central wallet balance.
    if (isPaid) {
      const availableAt = new Date(Date.now() + EARNINGS_CLEARING_DAYS * 24 * 60 * 60 * 1000)
      const feeMinor = Math.round(amountMinor * (1 - split.share))
      const netMinor = amountMinor - feeMinor
      try {
        const instructor = await User.findById(course.instructor).select("authUserId")
        if (instructor?.authUserId) {
          await Earning.create({
            enrollment: enrollment._id,
            order: order?._id ?? null,
            course: course._id,
            instructor: course.instructor,
            instructorAuthUserId: instructor.authUserId,
            student: user.id,
            kind: "sale",
            grossMinor: amountMinor,
            feeMinor,
            netMinor,
            currency: "USD",
            status: "pending",
            availableAt,
            // Same generation suffix as the charge: a re-purchase is a new sale
            // and must earn again, but the enrollment id is unchanged so the
            // bare reference would collide with the original (refunded) sale.
            creditReference:
              generation > 0
                ? `academy_earn_${enrollment._id.toString()}_r${generation}`
                : `academy_earn_${enrollment._id.toString()}`,
            chargeId,
          })
        }
      } catch (err) {
        console.error("[Earnings] failed to record sale earning:", err)
      }

      // The referral commission (owner, 2026-10-05): a share of this purchase
      // by the plan bought (Basic 10%, Standard 12%, Executive 15%, else 10%),
      // out of the Academy's share, to the referrer's wallet after the same
      // clearing window. Every purchase earns, not only the first (client,
      // 2026-11-05). Only on a "referral" sale — never a self-referral, never
      // on a sale the seller's own link made. The referrer may be any user.
      if (split.attribution?.kind === "referral" && referrer && order) {
        await bookReferralCommission({
          referrer,
          buyerId: user.id,
          orderId: order._id.toString(),
          enrollmentId: enrollment._id.toString(),
          courseId: course._id.toString(),
          amountMinor,
          packageKey: pkg?.key ?? null,
          chargeId,
          via: "wallet",
        })
      }
    }

    // Update course + instructor aggregates. Pre-enrollment already counted
    // this student, so activation only moves money aggregates. Display
    // counters only: a failure is logged, never shown to the paid learner.
    try {
      if (!isActivation) {
        await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } })
      }
      await User.findByIdAndUpdate(course.instructor, {
        $inc: {
          ...(isActivation ? {} : { "instructorProfile.totalStudents": 1 }),
          "instructorProfile.totalEarnings": isPaid ? price * split.share : 0,
        },
      })
    } catch (err) {
      console.error("[Payments] enrolled, but the course/instructor counters didn't update:", err)
    }

    // Executive (D4): the instructor and admins schedule onboarding; the
    // buyer's intake form waits on the success page. Keyed on the Executive
    // tier — single "Full program" tiers also carry mentorship: true.
    if (pkg?.key === "executive" && pkg.entitlements.mentorship) {
      const buyer = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
      const note = {
        type: "course" as const,
        title: `New ${pkg.name} enrollment`,
        body: `${buyer} enrolled in ${course.title} — schedule their onboarding.`,
      }
      void notifyUser(course.instructor.toString(), { ...note, href: `/instructor/courses/${courseId}`, courseId: String(courseId) })
      void notifyAdmins({ ...note, href: `/admin/enrollments?course=${courseId}` })
    }

    void sendEnrollmentConfirmationEmail({
      to: user.email ?? "",
      firstName: user.firstName ?? "",
      courseTitle: course.title,
      courseId: course._id.toString(),
      availableAtIso: null,
      isPaid,
      price,
      packageName: packageFields.packageName,
    })
    // D27: one welcome on the learner's first paid enrollment — after the confirmation, never awaited.
    if (isPaid) void sendWelcomeOnce(user.id, enrollment._id.toString())

    try {
      revalidatePath("/dashboard/my-courses")
      revalidatePath(`/courses/${courseId}`)
    } catch (err) {
      console.error("[Payments] enrolled, but the page refresh failed:", err)
    }

    return {
      success: true,
      data: { enrollmentId: enrollment._id.toString(), packageName: packageFields.packageName },
    }
  } catch (error) {
    console.error("Enroll in course error:", error)
    return { success: false, error: "Failed to enroll in course", code: "enroll_failed" }
  }
}

// ============================================================================
// PLAN UPGRADES (2026-11-12, Owen: "charge the difference")
// ============================================================================
//
// A learner holding an active or completed place on a lower plan moves to a
// higher one by paying the difference: the new plan's price less what the
// place has paid so far (`pricePaid`, which every upgrade adds to; when it is
// 0, the current plan's price). Each upgrade is its own Order under its own
// key family, `academy_upgrade_<user>_<course>_<toPlan>[_r<refunds>][_d<declines>]`,
// which can never meet an `academy_enroll_…` key. Same rules as a purchase: a
// fresh `_d` only after an insufficient-balance decline, every other failure
// replays the same key, and an unknown outcome is never "not charged".

export type UpgradeErrorCode =
  | "auth"
  | "invalid"
  | "not_found"
  | "not_enrolled"
  | "pre_enrolled"
  | "on_hold"
  | "not_eligible"
  | "full_access"
  | "no_upgrade"
  | "price_changed"
  | "insufficient_funds"
  | "wallet_unavailable"
  | "confirming"
  | "plan_changed"
  | "upgrade_failed"

export type UpgradeResult =
  | { success: true; data: { enrollmentId: string; packageName: string | null } }
  | { success: false; error: string; code?: UpgradeErrorCode; shortfallMinor?: number; availableMinor?: number }

/** One higher plan a place can move to, and what moving costs. Integer US cents. */
export type UpgradeOption = { key: PackageKey; name: string; priceMinor: number; upgradeMinor: number }

/** Where the signed-in learner's place stands, for the program page and checkout. */
export type UpgradeOptions = {
  enrollmentId: string
  current: { key: PackageKey; name: string }
  /** What the place has paid so far, in cents (or its plan's price when nothing is recorded). */
  paidMinor: number
  /** Higher plans on sale, in ladder order; empty on the top plan. */
  options: UpgradeOption[]
}

const NOT_CHARGED = "You have not been charged."

type UpgradeSeat = {
  status: string
  packageKey?: PackageKey | null
  packageName?: string | null
  pricePaid?: number | null
  legacyUnpaid?: boolean | null
}
type UpgradeCourse = {
  kind?: CourseKind | null
  pricing?: string | null
  price?: number | null
  packages?: ICoursePackage[] | null
}
type UpgradeRefusal = { ok: false; code: UpgradeErrorCode; error: string }
type UpgradeQuote = {
  ok: true
  from: { key: PackageKey; name: string }
  to: { key: PackageKey; name: string; priceMinor: number; mentorship: boolean }
  paidMinor: number
  upgradeMinor: number
}

/** Whether this place can change plan by paying, and what it has paid. Pure. */
function upgradeBaseFor(
  seat: UpgradeSeat,
  course: UpgradeCourse
): { ok: true; from: { key: PackageKey; name: string }; paidMinor: number } | UpgradeRefusal {
  if (seat.status === "pre_enrolled") {
    return { ok: false, code: "pre_enrolled", error: `You've reserved a place on this program: choose a plan and pay for it at checkout. ${NOT_CHARGED}` }
  }
  if (["suspended", "cancelled", "expired"].includes(seat.status)) {
    return {
      ok: false,
      code: "on_hold",
      error: `Your place on this program is on hold, so its plan can't be changed here. Contact support and we'll sort it out. ${NOT_CHARGED}`,
    }
  }
  if (seat.status !== "active" && seat.status !== "completed") {
    return { ok: false, code: "not_enrolled", error: `Only a place you hold can be upgraded. ${NOT_CHARGED}` }
  }
  // No plan on record is full access (grandfathered): there is nothing above it.
  if (!seat.packageKey) return { ok: false, code: "full_access", error: `Your place already includes everything. ${NOT_CHARGED}` }
  // Granted without a real charge before payments existed: what it "paid" isn't money. Support decides.
  if (seat.legacyUnpaid) {
    return { ok: false, code: "not_eligible", error: `Contact support to change the plan of this place. ${NOT_CHARGED}` }
  }
  if (courseKindOf(course) === "marketplace" || !kindIsOpen(course.kind) || !isOnSale(course) || !sellsPackages(course)) {
    return { ok: false, code: "not_eligible", error: `This program isn't offering upgrades right now. ${NOT_CHARGED}` }
  }
  // The plan held, enabled or not: buyers keep what they paid for.
  const current = (course.packages ?? []).find((p) => p.key === seat.packageKey) ?? null
  const pricePaid = typeof seat.pricePaid === "number" && Number.isFinite(seat.pricePaid) ? seat.pricePaid : 0
  const paidMinor = pricePaid > 0 ? Math.round(pricePaid * 100) : current ? Math.round(current.price * 100) : null
  if (paidMinor === null || !Number.isFinite(paidMinor) || paidMinor < 0) {
    return { ok: false, code: "not_eligible", error: `Contact support to change the plan of this place. ${NOT_CHARGED}` }
  }
  return {
    ok: true,
    from: { key: seat.packageKey, name: seat.packageName ?? current?.name ?? PACKAGE_LABEL[seat.packageKey] },
    paidMinor,
  }
}

/** The price of moving this place to `toKey`, or why it can't. Pure: the one rule the page, checkout and the charge share. */
function quoteUpgrade(seat: UpgradeSeat, course: UpgradeCourse, toKey: PackageKey): UpgradeQuote | UpgradeRefusal {
  const base = upgradeBaseFor(seat, course)
  if (!base.ok) return base
  const target = packageFor(course, toKey)
  if (!target) return { ok: false, code: "not_eligible", error: `That plan isn't on sale right now. ${NOT_CHARGED}` }
  // No downgrades and no same plan, whatever the prices say.
  if (PACKAGE_RANK[toKey] <= PACKAGE_RANK[base.from.key]) {
    return { ok: false, code: "no_upgrade", error: `You already have this plan or a higher one. ${NOT_CHARGED}` }
  }
  const priceMinor = Math.round(target.price * 100)
  const upgradeMinor = priceMinor - base.paidMinor
  if (!Number.isInteger(upgradeMinor) || upgradeMinor <= 0) {
    return {
      ok: false,
      code: "no_upgrade",
      error: `What you've paid already covers this plan. Contact support to move to it. ${NOT_CHARGED}`,
    }
  }
  return {
    ok: true,
    from: base.from,
    to: { key: toKey, name: target.name, priceMinor, mentorship: Boolean(target.entitlements?.mentorship) },
    paidMinor: base.paidMinor,
    upgradeMinor,
  }
}

/**
 * The signed-in learner's place on this program and the higher plans it can
 * move to (the program page's "Your plan", and checkout). null when the place
 * can't change plan by paying at all: no place, a reservation, on hold, full
 * access, or a program not selling upgrades. Read-only.
 */
export async function getUpgradeOptions(courseId: string): Promise<UpgradeOptions | null> {
  try {
    if (typeof courseId !== "string" || !/^[a-f0-9]{24}$/i.test(courseId)) return null
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null
    const [seat, course] = await Promise.all([
      Enrollment.findOne({ user: user.id, course: courseId }).select("status packageKey packageName pricePaid legacyUnpaid").lean(),
      Course.findOne({ _id: courseId, status: "published" }).select("kind pricing price packages").lean(),
    ])
    if (!seat || !course) return null
    const base = upgradeBaseFor(seat, course)
    if (!base.ok) return null
    const options = PACKAGE_KEYS.flatMap((key): UpgradeOption[] => {
      const quote = quoteUpgrade(seat, course, key)
      return quote.ok ? [{ key, name: quote.to.name, priceMinor: quote.to.priceMinor, upgradeMinor: quote.upgradeMinor }] : []
    })
    return { enrollmentId: String(seat._id), current: base.from, paidMinor: base.paidMinor, options }
  } catch (error) {
    console.error("Get upgrade options error:", error)
    return null
  }
}

/**
 * Before an upgrade is charged: another upgrade of this place whose payment
 * may have gone through is settled first, so a learner whose earlier upgrade
 * did take the money isn't charged for a second one. Its charge is looked for:
 * found, the learner is pointed back to that plan (choosing it adopts the
 * charge, nothing new is taken); refunded, the order is marked so; not in the
 * wallet once it can no longer be in flight, it is marked as moving no money.
 * Returns the refusal copy, or null when nothing is in the way.
 */
async function otherUpgradeRefusal(
  userId: string,
  courseId: string,
  enrollmentId: Types.ObjectId,
  reference: string,
  authUserId: string
): Promise<string | null> {
  const others = await Order.find({
    user: userId,
    course: courseId,
    kind: "upgrade",
    enrollment: enrollmentId,
    reference: { $ne: reference },
    status: { $in: ["payment_requested", "paid", "failed"] },
  })
    .sort({ createdAt: -1 })
    .limit(10)
  for (const other of others) {
    if (!(await mayHoldCharge(other))) continue
    const plan = other.packageKey ? PACKAGE_LABEL[other.packageKey] : "another plan"
    const earlier = await findEarlierCharge(authUserId, other)
    if (earlier.kind === "found") {
      return `Your earlier payment to upgrade to ${plan} went through. Choose ${plan} to finish that upgrade without paying again, or contact support.`
    }
    if (earlier.kind === "unavailable") return STILL_CONFIRMING
    if (earlier.kind === "refunded") {
      other.chargeId = earlier.chargeId
      await transitionOrder(other, "refunded", "its charge was refunded in the wallet")
      await logPaymentEvent(other._id, other.reference, "charge_replayed_refunded", { chargeId: earlier.chargeId, via: "history" })
      continue
    }
    if (Date.now() - other.updatedAt.getTime() < CHARGE_IN_FLIGHT_MS) {
      return "Another payment for this program is still going through. Try again in a few minutes."
    }
    other.failureCode = NO_CHARGE_FOUND
    await transitionOrder(other, "failed", "no charge for this order in the wallet")
    await logPaymentEvent(other._id, other.reference, "charge_not_found", {})
  }
  return null
}

const UpgradeInput = z.object({
  courseId: z.string().regex(/^[a-f0-9]{24}$/),
  packageKey: z.enum(PACKAGE_KEYS),
  // The difference checkout showed, in cents. Required: nothing is charged that wasn't shown.
  expectedMinor: z.number().int().positive(),
})

const UPGRADE_UNCONFIRMED =
  "We couldn't confirm your payment with your WorldStreet wallet. Please try again: you won't be charged twice. If your balance went down and your plan didn't change, contact support."

/**
 * Move the signed-in learner's place on a program to a higher plan, charging
 * the difference (2026-11-12, Owen). Identity comes from the session, the
 * price from the course and the place — nothing money-related is trusted
 * from the client, and the figure checkout showed must match. The new plan is
 * applied only after the wallet confirms the debit, and only while the place
 * still holds the plan it was priced from; otherwise the charge is refunded.
 * Once the plan is applied nothing after it can fail the upgrade.
 */
export async function upgradeEnrollment(input: {
  courseId: string
  packageKey: PackageKey
  expectedMinor: number
}): Promise<UpgradeResult> {
  try {
    await connectDB()

    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in to upgrade", code: "auth" }

    const parsed = UpgradeInput.safeParse(input)
    if (!parsed.success) return { success: false, error: `That upgrade link isn't valid. ${NOT_CHARGED}`, code: "invalid" }
    const { courseId, packageKey: toKey, expectedMinor } = parsed.data

    // Read by the signed-in learner's own id: nobody upgrades a place that isn't theirs.
    const [enrollment, course] = await Promise.all([
      Enrollment.findOne({ user: user.id, course: courseId }),
      Course.findOne({ _id: courseId, status: "published" }),
    ])
    if (!course) return { success: false, error: `This program isn't available. ${NOT_CHARGED}`, code: "not_found" }
    if (!enrollment) return { success: false, error: `Only a place you hold can be upgraded. ${NOT_CHARGED}`, code: "not_enrolled" }

    const quote = quoteUpgrade(enrollment, course, toKey)
    if (!quote.ok) return { success: false, error: quote.error, code: quote.code }
    if (expectedMinor !== quote.upgradeMinor) {
      return {
        success: false,
        error: `The price of this upgrade changed since you opened this page. Check the new price, then pay. ${NOT_CHARGED}`,
        code: "price_changed",
      }
    }
    // Never change a plan without a confirmed debit.
    if (!walletEnabled()) {
      return { success: false, error: `Payments are temporarily unavailable. Please try again later. ${NOT_CHARGED}`, code: "wallet_unavailable" }
    }

    const fromKey = quote.from.key
    const sameTarget = { user: user.id, course: courseId, kind: "upgrade" as const, packageKey: toKey }
    const [refunds, declines] = await Promise.all([
      Order.countDocuments({ ...sameTarget, status: "refunded" }),
      Order.countDocuments({ ...sameTarget, status: "failed", failureCode: "insufficient_funds" }),
    ])
    const reference = `academy_upgrade_${user.id}_${courseId}_${toKey}${refunds > 0 ? `_r${refunds}` : ""}${declines > 0 ? `_d${declines}` : ""}`

    const blocked = await otherUpgradeRefusal(user.id, courseId, enrollment._id, reference, user.authUserId)
    if (blocked) return { success: false, error: blocked, code: "confirming" }

    const ord = await Order.findOneAndUpdate(
      { reference },
      {
        $setOnInsert: {
          user: user.id,
          authUserId: user.authUserId,
          course: courseId,
          reference,
          amountMinor: quote.upgradeMinor,
          currency: "USD",
          packageKey: toKey,
          kind: "upgrade",
          fromPackageKey: fromKey,
          enrollment: enrollment._id,
          status: "pending",
          history: [{ status: "pending", at: new Date() }],
        },
      },
      { upsert: true, new: true }
    )
    if (!ord) return { success: false, error: `Couldn't start the upgrade. ${NOT_CHARGED}`, code: "upgrade_failed" }
    // This key already moved this place to the plan once, and the place has
    // since left it (an admin's change): replaying it must not open it again.
    if (ord.status === "enrolled") {
      return {
        success: false,
        error: "This upgrade was already paid on your place. Contact support and we'll sort it out. Nothing new has been charged.",
        code: "not_eligible",
      }
    }
    if (ord.status === "refunded" || ord.status === "cancelled") {
      return { success: false, error: "Something changed while you were paying. Refresh the page and try again. Nothing new has been charged.", code: "plan_changed" }
    }

    // An earlier attempt of this order may have taken the money (Task 2 above).
    const prior = await settlePriorAttempt(ord, user.authUserId, quote.upgradeMinor)
    if (prior.action === "refuse") {
      await logPaymentEvent(ord._id, reference, "charge_deferred", { reason: prior.reason })
      console.error("[Payments] earlier upgrade attempt unconfirmed, not charging again:", reference, prior.reason)
      return { success: false, error: prior.error, code: "confirming" }
    }
    if (prior.action === "refunded") {
      ord.chargeId = prior.chargeId
      await transitionOrder(ord, "refunded", "its charge was refunded in the wallet — the next try gets a fresh key")
      await logPaymentEvent(ord._id, reference, "charge_replayed_refunded", { chargeId: prior.chargeId, via: "history" })
      return {
        success: false,
        error: "Your earlier payment for this upgrade was refunded, so it can't be used again. Tap Pay once more to make a new payment.",
        code: "wallet_unavailable",
      }
    }

    // A retry after a price change asks for today's figure: the order says what is being charged.
    if (prior.action === "charge" && ord.amountMinor !== quote.upgradeMinor) ord.amountMinor = quote.upgradeMinor
    await transitionOrder(ord, "payment_requested")
    await logPaymentEvent(ord._id, reference, "charge_requested", {
      amountMinor: quote.upgradeMinor,
      courseId,
      packageKey: toKey,
      fromPackageKey: fromKey,
      kind: "upgrade",
      authUserId: user.authUserId,
    })

    let charge: ConfirmedCharge
    try {
      if (prior.action === "adopt") {
        charge = prior.charge
        await logPaymentEvent(ord._id, reference, "charge_adopted", {
          chargeId: prior.charge.id,
          amountMinor: prior.charge.amountMinor,
          matchedBy: prior.matchedBy,
        })
      } else {
        ;({ charge } = await createWalletCharge(user.authUserId, {
          amountMinor: quote.upgradeMinor,
          description: `Course upgrade: ${course.title} — ${quote.from.name} to ${quote.to.name}`,
          metadata: {
            reference,
            kind: "upgrade",
            courseId: course._id.toString(),
            courseSlug: course.slug ?? "",
            packageKey: toKey,
            fromPackageKey: fromKey,
          },
          idempotencyKey: reference,
        }))
      }
    } catch (err) {
      if (isInsufficientBalance(err)) {
        const details = err.details as { availableMinor?: number }
        const availableMinor = typeof details.availableMinor === "number" ? details.availableMinor : 0
        ord.failureCode = "insufficient_funds"
        await transitionOrder(ord, "failed", "insufficient funds")
        await logPaymentEvent(ord._id, reference, "charge_failed", { code: "INSUFFICIENT_BALANCE", availableMinor })
        return {
          success: false,
          error: "Your Worldstreet balance doesn't cover this upgrade.",
          code: "insufficient_funds",
          availableMinor,
          shortfallMinor: Math.max(0, quote.upgradeMinor - availableMinor),
        }
      }
      const code = err instanceof WalletError ? err.code : "WALLET_ERROR"
      // Only a refusal from the wallet proves no money moved (as in purchaseCourse).
      const outcomeUnknown = !(err instanceof WalletError) || code === "WALLET_UNAVAILABLE" || err.status >= 500
      ord.failureCode = code
      await transitionOrder(ord, "failed", code)
      await logPaymentEvent(ord._id, reference, "charge_failed", {
        code,
        outcomeUnknown,
        message: err instanceof Error ? err.message : String(err),
      })
      console.error("[Payments] wallet upgrade charge failed:", err)
      return {
        success: false,
        error: outcomeUnknown ? UPGRADE_UNCONFIRMED : `Your WorldStreet wallet couldn't take this payment. ${NOT_CHARGED}`,
        code: "wallet_unavailable",
      }
    }

    // An answer with no charge in it confirms nothing, and may still have taken the money.
    if (!charge?.id) {
      ord.failureCode = "CHARGE_UNCONFIRMED"
      await transitionOrder(ord, "failed", "the wallet answered without a charge")
      await logPaymentEvent(ord._id, reference, "charge_failed", { code: "CHARGE_UNCONFIRMED", outcomeUnknown: true })
      console.error("[Payments] wallet answered an upgrade without a charge:", reference)
      return { success: false, error: UPGRADE_UNCONFIRMED, code: "wallet_unavailable" }
    }
    // A replayed charge that was already refunded is no payment.
    if (charge.status === "refunded") {
      ord.chargeId = charge.id
      await transitionOrder(ord, "refunded", "the wallet replayed a refunded charge — the next try gets a fresh key")
      await logPaymentEvent(ord._id, reference, "charge_replayed_refunded", { chargeId: charge.id })
      console.error("[Payments] wallet replayed a refunded upgrade charge, plan unchanged:", reference, charge.id)
      return {
        success: false,
        error: "Your earlier payment for this upgrade was refunded, so it can't be used again. Tap Pay once more to make a new payment.",
        code: "wallet_unavailable",
      }
    }

    // The debit is confirmed. What moved is the wallet's own figure: a replay
    // answers with the first attempt's charge.
    const chargeId = charge.id
    const paidNowMinor = Number.isInteger(charge.amountMinor) && charge.amountMinor > 0 ? charge.amountMinor : quote.upgradeMinor
    ord.chargeId = chargeId
    if (paidNowMinor !== ord.amountMinor) {
      console.error("[Payments] upgrade charge differs from the order — recording the charge:", reference, ord.amountMinor, paidNowMinor)
      ord.amountMinor = paidNowMinor
    }
    try {
      await transitionOrder(ord, "paid")
    } catch (err) {
      console.error("[Payments] upgrade charge confirmed but the order didn't save — applying anyway:", chargeId, err)
    }
    await logPaymentEvent(ord._id, reference, "charge_confirmed", { chargeId, amountMinor: paidNowMinor })

    // Apply the plan, only while the place still holds access on the plan it
    // was priced from: two tabs upgrading to different plans can't both land,
    // and a refund or an admin's change in between isn't overwritten.
    const newPaidMinor = quote.paidMinor + paidNowMinor
    let applied = false
    try {
      const updated = await Enrollment.findOneAndUpdate(
        { _id: enrollment._id, user: user.id, status: { $in: ["active", "completed"] }, packageKey: fromKey },
        { $set: { packageKey: toKey, packageName: quote.to.name, pricePaid: newPaidMinor / 100 } },
        { new: true }
      )
      applied = Boolean(updated)
    } catch (err) {
      console.error("[Payments] upgrade write failed — checking whether it landed:", reference, err)
    }
    if (!applied) {
      // A same-key sibling tab (the wallet replayed it this same charge) may
      // have applied it already, or our own write landed before it errored.
      // Then the place holds the new plan at exactly this total.
      let now: { status: string; packageKey?: PackageKey | null; pricePaid?: number | null } | null = null
      try {
        now = await Enrollment.findById(enrollment._id).select("status packageKey pricePaid").lean()
      } catch (err) {
        // Can't tell whether the plan changed: never refund a charge that may hold it.
        console.error("[Payments] UPGRADE UNCONFIRMED — charged, plan unknown, needs a look:", reference, chargeId, err)
        return {
          success: false,
          error: "Your payment went through, but we couldn't confirm your new plan yet. Refresh in a minute; if it hasn't changed, contact support.",
          code: "upgrade_failed",
        }
      }
      const landed =
        now !== null &&
        (now.status === "active" || now.status === "completed") &&
        now.packageKey === toKey &&
        Math.round((now.pricePaid ?? 0) * 100) === newPaidMinor
      if (!landed) {
        // This charge bought nothing: the place changed plan or lost access
        // meanwhile. Refunded, so no money is kept without the plan.
        let refunded = false
        try {
          await refundWalletCharge(user.authUserId, chargeId, "the place changed before the upgrade applied")
          refunded = true
        } catch (refundErr) {
          console.error("[Payments] ORPHANED CHARGE — upgrade refund failed, needs reconciliation:", chargeId, refundErr)
        }
        if (refunded) {
          await transitionOrder(ord, "refunded", "compensating refund — the place changed before the upgrade applied").catch((err) =>
            console.error("[Payments] upgrade refunded, but the order didn't save:", reference, err)
          )
          await logPaymentEvent(ord._id, reference, "charge_refunded", { chargeId })
          return {
            success: false,
            error: "Your plan changed while you were paying, so this payment was refunded to your wallet. Refresh the page to see your plan.",
            code: "plan_changed",
          }
        }
        await transitionOrder(ord, "failed", "upgrade not applied AND refund failed — orphaned charge").catch((err) =>
          console.error("[Payments] orphaned upgrade charge, and the order didn't save:", reference, err)
        )
        await logPaymentEvent(ord._id, reference, "refund_failed", { chargeId })
        return {
          success: false,
          error: "Your plan changed while you were paying. We're refunding this payment to your wallet; contact support if it hasn't arrived within a day.",
          code: "plan_changed",
        }
      }
    }

    // The place holds the new plan and the learner has paid (as in
    // purchaseCourse after the seat exists): nothing below may fail the
    // upgrade. Each step is guarded on its own, and the ledger rows are keyed
    // on this order, so a sibling tab running these too books them once.
    await transitionOrder(ord, "enrolled").catch((err) =>
      console.error("[Payments] upgraded, but the order status didn't save:", reference, err)
    )

    // Progress and completion follow the new plan, as an admin plan change
    // does (adminSetEnrollmentPackage): the same denominator as completeLesson.
    // A completion the new plan hasn't earned (lessons it opens still to do, or
    // a final exam it now requires) goes back to active; never promotes.
    try {
      const access = await getCourseAccess(user.id, courseId)
      const seat = await Enrollment.findById(enrollment._id).select("status completedLessons examPassed progress")
      if (access && seat && access.packageKey === toKey) {
        const open = await openPublishedLessonIds(access)
        const done = seat.completedLessons.filter((id: Types.ObjectId) => open.has(id.toString())).length
        const progress = open.size > 0 ? Math.min(100, Math.round((done / open.size) * 100)) : 0
        const allDone = open.size > 0 && done === open.size
        const examGates = Boolean(course.examRequired) && access.entitlements.certificate && !seat.examPassed
        const reopen = seat.status === "completed" && (!allDone || examGates)
        const recounted = await Enrollment.findOneAndUpdate(
          { _id: enrollment._id, packageKey: toKey, status: seat.status },
          { $set: { progress, ...(reopen ? { status: "active", completedAt: null } : {}) } },
          { new: true }
        )
        // A completion the new plan certifies stores the ID its certificate prints.
        if (recounted) {
          await ensureCertificateId(recounted, false)
          await ensureCertificateTier(recounted._id)
        }
      }
    } catch (err) {
      console.error("[Payments] upgraded, but progress didn't recount:", err)
    }

    // Who made the sale, as for a purchase: the buyer's `wsa_ref` code, else
    // their account's referrer. Any error books it as the Academy's.
    const courseKind = courseKindOf(course)
    const sellerId = course.instructor.toString()
    const academySale = splitSale({ kind: courseKind, sellerId, buyerId: user.id, referrer: null })
    let split = academySale
    let referrer: Referrer | null = null
    try {
      referrer = await referrerFor(user.id, await referralCookieCode())
      split = splitSale({ kind: courseKind, sellerId, buyerId: user.id, referrer })
      if (split.attribution) {
        await Order.updateOne({ _id: ord._id }, { $set: { attribution: split.attribution } })
      }
    } catch (err) {
      console.error("[Referrals] upgrade attribution failed — booked as an Academy sale:", err)
      referrer = null
      split = academySale
    }
    if (referrer?.source === "link") {
      const { code, userId } = referrer
      await User.updateOne(
        { _id: user.id, referredBy: null },
        { $set: { referredBy: { text: code, at: new Date(), code, userId } } }
      ).catch((err) => console.error("[Referrals] failed to save who invited the buyer:", err))
    }

    // The instructor's share of the upgrade, on the same terms as a sale.
    const feeMinor = Math.round(paidNowMinor * (1 - split.share))
    const netMinor = paidNowMinor - feeMinor
    try {
      const instructor = await User.findById(course.instructor).select("authUserId")
      if (instructor?.authUserId) {
        await Earning.create({
          enrollment: enrollment._id,
          order: ord._id,
          course: course._id,
          instructor: course.instructor,
          instructorAuthUserId: instructor.authUserId,
          student: user.id,
          kind: "sale",
          grossMinor: paidNowMinor,
          feeMinor,
          netMinor,
          currency: "USD",
          status: "pending",
          availableAt: new Date(Date.now() + EARNINGS_CLEARING_DAYS * 24 * 60 * 60 * 1000),
          // One per upgrade order: a sibling tab, or a retry, books it once.
          creditReference: `academy_earn_upgrade_${ord._id.toString()}`,
          chargeId,
          note: `plan upgrade: ${fromKey} to ${toKey}`,
        })
      }
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) console.error("[Earnings] failed to record the upgrade's earning:", err)
    }

    // The referral commission on this order, at the NEW plan's rate on the
    // upgrade amount; one per order (referralCreditReference).
    if (split.attribution?.kind === "referral" && referrer) {
      await bookReferralCommission({
        referrer,
        buyerId: user.id,
        orderId: ord._id.toString(),
        enrollmentId: enrollment._id.toString(),
        courseId: course._id.toString(),
        amountMinor: paidNowMinor,
        packageKey: toKey,
        chargeId,
        via: "wallet",
      })
    }

    try {
      await User.findByIdAndUpdate(course.instructor, {
        $inc: { "instructorProfile.totalEarnings": (paidNowMinor / 100) * split.share },
      })
    } catch (err) {
      console.error("[Payments] upgraded, but the instructor's counter didn't update:", err)
    }

    void notifyUser(user.id, {
      type: "payment",
      title: "Plan upgraded",
      body: `You're now on ${quote.to.name} in ${course.title}.`,
      href: `/dashboard/courses/${courseId}`,
      courseId: String(courseId),
    })
    // Executive (D4): onboarding is scheduled for them; their intake form waits on the success page.
    if (toKey === "executive" && quote.to.mentorship) {
      const buyer = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
      const note = {
        type: "course" as const,
        title: `Upgraded to ${quote.to.name}`,
        body: `${buyer} upgraded to ${quote.to.name} in ${course.title} — schedule their onboarding.`,
      }
      void notifyUser(course.instructor.toString(), { ...note, href: `/instructor/courses/${courseId}`, courseId: String(courseId) })
      void notifyAdmins({ ...note, href: `/admin/enrollments?course=${courseId}` })
    }

    try {
      revalidatePath("/dashboard/my-courses")
      revalidatePath(`/dashboard/courses/${courseId}`)
      if (course.slug) revalidatePath(`/programs/${course.slug}`)
    } catch (err) {
      console.error("[Payments] upgraded, but the page refresh failed:", err)
    }

    return { success: true, data: { enrollmentId: enrollment._id.toString(), packageName: quote.to.name } }
  } catch (error) {
    console.error("Upgrade enrollment error:", error)
    return { success: false, error: "Something went wrong with your upgrade. Please try again: you won't be charged twice.", code: "upgrade_failed" }
  }
}

/**
 * Mark a lesson as completed
 */
export async function completeLesson(
  userId: string,
  courseId: string,
  lessonId: string
) {
  try {
    await connectDB()

    // The learner's id comes from the caller: only the signed-in learner may
    // complete their own lessons (and earn their points).
    const current = await getCurrentUser()
    if (!current || current.id !== userId) return { success: false, error: "Not authenticated" }
    // 2026-11-12: only 24-hex ids reach a query (an object courseId reads as an operator).
    if (![courseId, lessonId].every((id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id))) {
      return { success: false, error: "Not enrolled in this course" }
    }

    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })

    if (!enrollment) {
      return { success: false, error: "Not enrolled in this course" }
    }

    const access = await getCourseAccess(userId, courseId)
    const locked = await lockedLessonIds(access)
    if (locked.has(lessonId)) {
      return { success: false, error: "This lesson isn't included in your plan", code: "package_locked" as const }
    }

    // Add lesson to completed if not already
    const lessonObjectId = new Types.ObjectId(lessonId)
    const lessonIdStr = lessonObjectId.toString()
    const completedIds = enrollment.completedLessons.map((id: Types.ObjectId) => id.toString())
    const newlyCompleted = !completedIds.includes(lessonIdStr)

    if (newlyCompleted) {
      enrollment.completedLessons.push(lessonObjectId)
    }

    enrollment.lastAccessedLesson = lessonObjectId
    enrollment.lastAccessedAt = new Date()

    // Progress counts only published lessons this package opens.
    const publishedIds = (await Lesson.find({ course: courseId, isPublished: true }).select("_id").lean()).map(
      (l) => l._id.toString()
    )
    const open = new Set(publishedIds.filter((id) => !locked.has(id)))
    const done = enrollment.completedLessons.filter((id: Types.ObjectId) => open.has(id.toString())).length
    enrollment.progress = open.size > 0 ? Math.min(100, Math.round((done / open.size) * 100)) : 0

    // Check if course is completed — when the course requires a CBT exam,
    // completion (and thus the certificate) waits for a passing attempt, unless
    // the package has no assessment & certificate.
    if (enrollment.progress >= 100) {
      const gatedCourse = await Course.findById(courseId).select("examRequired").lean()
      const examGates = !!gatedCourse?.examRequired && (access?.entitlements.certificate ?? true)
      // Only the transition stamps the date — an already-completed enrollment keeps it.
      if ((!examGates || enrollment.examPassed) && enrollment.status !== "completed") {
        enrollment.status = "completed"
        enrollment.completedAt = new Date()
      }
    }

    // A completion and its certificate ID (when the package certifies) land together.
    await saveWithCertificateId(enrollment)

    // Points for a lesson this package opens, once per enrollment and lesson.
    if (newlyCompleted && open.has(lessonIdStr)) {
      void awardPoints({
        userId,
        courseId,
        kind: "lesson_completed",
        points: POINTS.lesson_completed,
        key: pointKey.lesson(enrollment._id.toString(), lessonIdStr),
      })
    }

    revalidatePath(`/courses/${courseId}/learn/${lessonId}`)
    revalidatePath("/dashboard/my-courses")

    return {
      success: true,
      data: {
        progress: enrollment.progress,
        isCompleted: enrollment.status === "completed",
      },
    }
  } catch (error) {
    console.error("Complete lesson error:", error)
    return { success: false, error: "Failed to update progress" }
  }
}

/**
 * Update last accessed lesson (for resume functionality)
 */
export async function updateLastAccessed(
  userId: string,
  courseId: string,
  lessonId: string
) {
  try {
    // 2026-11-12: a server action is callable with any arguments. Only the signed-in learner moves
    // their own resume point, and only 24-hex ids reach a query (an object reads as an operator).
    const hex = /^[a-f0-9]{24}$/i
    if (![userId, courseId, lessonId].every((id) => typeof id === "string" && hex.test(id))) {
      return { success: false, error: "Failed to update" }
    }
    await connectDB()
    const me = await getCurrentUser()
    if (!me || me.id !== userId) return { success: false, error: "Failed to update" }
    if (!(await Lesson.exists({ _id: lessonId, course: courseId }))) return { success: false, error: "Failed to update" }

    // A lesson outside the student's package is never "where they left off".
    if (await isLessonLockedFor(userId, lessonId)) {
      return { success: false, error: "This lesson isn't included in your plan" }
    }

    await Enrollment.findOneAndUpdate(
      { user: userId, course: courseId },
      {
        lastAccessedLesson: lessonId,
        lastAccessedAt: new Date(),
      }
    )

    return { success: true }
  } catch (error) {
    console.error("Update last accessed error:", error)
    return { success: false, error: "Failed to update" }
  }
}

// ============================================================================
// ENROLLMENT QUERIES
// ============================================================================

/**
 * Get user's enrollments (my courses)
 */
export async function getUserEnrollments(
  userId: string,
  status?: "active" | "completed" | "all"
): Promise<EnrollmentWithCourse[]> {
  try {
    await connectDB()
    // 2026-11-12: browser-callable ("use server"): only the signed-in user's own enrollments.
    const me = await getCurrentUser()
    if (!me || typeof userId !== "string" || me.id !== userId) return []

    // "all" means all of the user's LIVE courses — a refunded purchase is not
    // one of them (the row is retained only for the payment audit trail).
    const query: Record<string, unknown> = { user: userId }
    if (status && status !== "all") {
      query.status = status
    } else {
      query.status = { $in: ["active", "completed", "expired"] }
    }

    const enrollments = await Enrollment.find(query)
      .populate({
        path: "course",
        select: "title slug thumbnailUrl instructor",
        populate: {
          path: "instructor",
          select: "firstName lastName",
        },
      })
      .sort({ lastAccessedAt: -1 })
      .lean()

    return enrollments.map((enrollment) => {
      const course = enrollment.course as unknown as {
        _id: { toString(): string }
        title: string
        slug: string
        thumbnailUrl: string
        instructor: { firstName: string; lastName: string }
      }

      return {
        id: enrollment._id.toString(),
        courseId: course._id.toString(),
        courseTitle: course.title,
        courseThumbnail: course.thumbnailUrl,
        instructorName: `${course.instructor.firstName} ${course.instructor.lastName}`,
        progress: enrollment.progress,
        completedLessons: enrollment.completedLessons.map((id: Types.ObjectId) => id.toString()),
        lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || new Date().toISOString(),
        status: enrollment.status,
      }
    })
  } catch (error) {
    console.error("Get user enrollments error:", error)
    return []
  }
}

/**
 * Get enrollment details with progress
 */
export async function getEnrollmentProgress(
  userId: string,
  courseId: string
): Promise<EnrollmentProgress | null> {
  try {
    await connectDB()
    // 2026-11-12: browser-callable ("use server"): only the signed-in user's own progress, 24-hex ids only.
    const me = await getCurrentUser()
    if (!me || typeof userId !== "string" || me.id !== userId) return null
    if (typeof courseId !== "string" || !/^[a-f0-9]{24}$/i.test(courseId)) return null

    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
    }).lean()

    if (!enrollment) {
      return null
    }

    // Only the published lessons this package opens count toward the total.
    const locked = await lockedLessonIds(await getCourseAccess(userId, courseId))
    const totalLessons = (await Lesson.find({ course: courseId, isPublished: true }).select("_id").lean()).filter(
      (l) => !locked.has(l._id.toString())
    ).length

    return {
      progress: enrollment.progress,
      completedLessons: enrollment.completedLessons.map((id: Types.ObjectId) => id.toString()),
      totalLessons,
      lastAccessedLesson: enrollment.lastAccessedLesson?.toString() || null,
    }
  } catch (error) {
    console.error("Get enrollment progress error:", error)
    return null
  }
}

/**
 * Check if user is enrolled in a course. Server actions are callable from the
 * browser with any arguments, so the userId must be the signed-in user's own —
 * anyone else reads as "not enrolled" rather than revealing another learner's
 * enrollment.
 */
export async function checkEnrollment(
  userId: string,
  courseId: string
): Promise<{ isEnrolled: boolean; status?: string; resumeLessonId?: string | null }> {
  try {
    const current = await getCurrentUser()
    if (!current || current.id !== userId) return { isEnrolled: false }

    await connectDB()

    // Access-granting statuses only: a refunded/expired row still exists (kept
    // for audit) but must read as "not enrolled", or the course page would
    // offer "Continue learning" into content the server will refuse, and
    // checkout would bounce the user to the success screen instead of letting
    // them buy the course back. pre_enrolled is surfaced via `status` with
    // isEnrolled false — a reservation, not access — so course pages can show
    // "Enrolled · starts …" without unlocking anything.
    const enrollment = await Enrollment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ["active", "completed", "pre_enrolled"] },
    }).select("status lastAccessedLesson")

    if (!enrollment) {
      return { isEnrolled: false }
    }

    return {
      isEnrolled: enrollment.status !== "pre_enrolled",
      status: enrollment.status,
      resumeLessonId: enrollment.lastAccessedLesson?.toString() ?? null,
    }
  } catch (error) {
    console.error("Check enrollment error:", error)
    return { isEnrolled: false }
  }
}

export type PreEnrollResult =
  | { success: true; data: { enrollmentId: string; alreadyEnrolled?: boolean } }
  | { success: false; error: string; code?: "auth" | "not_found" | "not_open" | "already_live" }

/**
 * Reserve a seat on a scheduled course before it goes live. Never charges:
 * the record is a reservation (status "pre_enrolled") that purchaseCourse
 * later activates — payment happens there, once the course is live.
 */
export async function preEnrollCourse(courseId: string): Promise<PreEnrollResult> {
  try {
    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "You need to be signed in to enroll", code: "auth" }
    }

    // 24 hex only (2026-11-12): isValid also passes any 12-character string.
    // if (typeof courseId !== "string" || !Types.ObjectId.isValid(courseId)) {
    if (typeof courseId !== "string" || !/^[a-f0-9]{24}$/i.test(courseId)) {
      return { success: false, error: "Course not found" }
    }
    const course = await Course.findOne({ _id: courseId, status: "published" })
    if (!course) {
      return { success: false, error: "Course not found or not available", code: "not_found" }
    }
    if (courseAvailability(course) !== "coming_soon") {
      // The course went live between render and click — the normal purchase
      // flow is the right door now.
      return { success: false, error: "This course is already live", code: "already_live" }
    }
    if (!course.preEnrollEnabled) {
      return { success: false, error: "Pre-launch enrollment isn't open for this course", code: "not_open" }
    }
    // A reservation is paid for at launch, so only a course on sale takes one.
    if (!kindIsOpen(course.kind)) {
      return { success: false, error: "The marketplace opens soon.", code: "not_found" }
    }
    if (!isOnSale(course)) {
      return { success: false, error: "This course isn't on sale.", code: "not_found" }
    }

    const existing = await Enrollment.findOne({ user: user.id, course: courseId })
    if (existing && !["refunded", "cancelled"].includes(existing.status)) {
      return { success: true, data: { enrollmentId: existing._id.toString(), alreadyEnrolled: true } }
    }

    let enrollment
    if (existing) {
      // A refunded/cancelled row coming back as a reservation keeps its audit
      // trail; activation will restamp the money fields.
      enrollment = await Enrollment.findOneAndUpdate(
        { user: user.id, course: courseId },
        {
          $set: {
            status: "pre_enrolled",
            preEnrolledAt: new Date(),
            pricePaid: 0,
            transactionId: null,
          },
        },
        { new: true }
      )
      if (!enrollment) throw new Error("pre-enroll: enrollment row vanished")
    } else {
      try {
        enrollment = await Enrollment.create({
          user: user.id,
          course: courseId,
          status: "pre_enrolled",
          preEnrolledAt: new Date(),
          pricePaid: 0,
        })
      } catch (err: unknown) {
        const isDuplicate =
          typeof err === "object" && err !== null && (err as { code?: number }).code === 11000
        if (!isDuplicate) throw err
        const winner = await Enrollment.findOne({ user: user.id, course: courseId })
        if (!winner) throw err
        return { success: true, data: { enrollmentId: winner._id.toString(), alreadyEnrolled: true } }
      }
      await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } })
      await User.findByIdAndUpdate(course.instructor, {
        $inc: { "instructorProfile.totalStudents": 1 },
      })
    }

    const availableAtIso = course.availableAt ? course.availableAt.toISOString() : null
    void sendEnrollmentConfirmationEmail({
      to: user.email ?? "",
      firstName: user.firstName ?? "",
      courseTitle: course.title,
      courseId: course._id.toString(),
      availableAtIso,
      isPaid: course.pricing === "paid",
      price: course.price ?? 0,
      packageName: null,
    })

    revalidatePath("/dashboard/my-courses")
    revalidatePath(`/courses/${courseId}`)

    return { success: true, data: { enrollmentId: enrollment._id.toString() } }
  } catch (error) {
    console.error("Pre-enroll error:", error)
    return { success: false, error: "Failed to enroll in course" }
  }
}

// ============================================================================
// CHECKOUT CONFIRMATION (spec §12, §17 "Enrollment confirmed")
// ============================================================================

export type CheckoutConfirmation = {
  courseId: string
  courseTitle: string
  packageName: string | null
  /** Executive buyers who haven't sent their onboarding intake yet (D4). */
  needsIntake: boolean
  /** Executive buyers whose intake is already with their mentor. */
  intakeSent: boolean
}

/** What the success page confirms. null when the caller has no access-granting enrollment on the course. */
export async function getCheckoutConfirmation(courseId: string): Promise<CheckoutConfirmation | null> {
  try {
    // Browser-callable: only a 24-hex id reaches a query (an object would read as an operator).
    if (typeof courseId !== "string" || !/^[a-f0-9]{24}$/i.test(courseId)) return null
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return null

    const access = await getCourseAccess(user.id, courseId)
    if (!access) return null

    const [course, enrollment] = await Promise.all([
      Course.findById(courseId).select("title").lean(),
      Enrollment.findById(access.enrollmentId).select("mentorshipIntake").lean(),
    ])
    if (!course) return null

    // Where "Start learning" lands is `getLearnStart` (lib/course-access.ts), read by the page.
    const executive = access.packageKey === "executive" && access.entitlements.mentorship
    return {
      courseId,
      courseTitle: course.title,
      packageName: access.packageName,
      needsIntake: executive && !enrollment?.mentorshipIntake,
      intakeSent: executive && Boolean(enrollment?.mentorshipIntake),
    }
  } catch (error) {
    console.error("Get checkout confirmation error:", error)
    return null
  }
}

const IntakeInput = z.object({
  goals: z.string().trim().min(10, "Tell your mentor a little more about your goals").max(2000, "Keep your goals under 2,000 characters"),
  availability: z.string().trim().min(2, "Share when you're usually available").max(500, "Keep availability under 500 characters"),
})

/**
 * One-time Executive onboarding intake (D4). Goals and availability are stored
 * on the enrollment and sent to the instructor, who schedules onboarding —
 * session booking itself is Phase 7.
 */
export async function submitMentorshipIntake(
  courseId: string,
  input: { goals: string; availability: string }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // Browser-callable: only a 24-hex id reaches a query.
    if (typeof courseId !== "string" || !/^[a-f0-9]{24}$/i.test(courseId)) {
      return { success: false, error: "Your plan doesn't include mentorship" }
    }
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const access = await getCourseAccess(user.id, courseId)
    if (!access || access.packageKey !== "executive" || !access.entitlements.mentorship) {
      return { success: false, error: "Your plan doesn't include mentorship" }
    }

    const parsed = IntakeInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" }
    }

    // The filter only matches an enrollment without an intake: one-time, race-safe.
    const updated = await Enrollment.findOneAndUpdate(
      { _id: access.enrollmentId, mentorshipIntake: null },
      { $set: { mentorshipIntake: { ...parsed.data, submittedAt: new Date() } } },
      { new: true }
    )
    if (!updated) return { success: false, error: "You've already sent your intake" }

    const buyer = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    // The owner and the program's assigned faculty, who run its mentorship.
    void courseTeacherIds(access.course.id)
      .catch(() => [access.course.instructorId])
      .then((ids) =>
        notifyUsers(ids, {
          type: "course",
          title: "Executive intake received",
          body: `${buyer}: ${parsed.data.goals}`.slice(0, 500),
          // The student's page: the owner and assigned faculty can both open it.
          href: `/instructor/students/${access.enrollmentId}`,
          courseId: String(courseId),
        })
      )

    revalidatePath("/dashboard/checkout/success")
    return { success: true }
  } catch (error) {
    console.error("Submit mentorship intake error:", error)
    return { success: false, error: "Couldn't send your intake — try again" }
  }
}
