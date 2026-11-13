"use server"

import { revalidatePath } from "next/cache"
import { Types } from "mongoose"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import {
  Course,
  Earning,
  Enrollment,
  ManualPayment,
  Order,
  PaymentEvent,
  User,
  type ICourse,
  type IOrder,
  type ManualPaymentStatus,
  type OrderStatus,
  type PackageKey,
} from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth/actions"
import { requireSuperAdmin } from "@/lib/auth/admin" // CTO 2026-11-08: transfers and outside payments are reconciled by the super admin only
import { courseAvailability } from "@/lib/types/course"
import { PACKAGE_KEYS, packageFor, sellsPackages } from "@/lib/entitlements"
import { notifyAdmins, notifyUser } from "@/lib/notify"
import { appUrl } from "@/lib/app-url"
import { courseKindOf } from "@/lib/course-kind"
import { kindIsOpen } from "@/lib/marketplace"
import { normalizeReferralCode } from "@/lib/referral-link"
import { bookReferralCommission, referralCookieCode, referralOwner, referrerFor, splitSale } from "@/lib/referrals"
import {
  NAIRA_RATE_MAX,
  NAIRA_RATE_MIN,
  getNairaQuote,
  getNairaRateAdminView,
  recentlyQuotedRate,
  setPinnedNairaRate,
  type NairaRateAdminView,
} from "@/lib/naira-rate"
import {
  sendEnrollmentConfirmationEmail,
  sendEspeePaymentAdminEmail,
  sendEspeePaymentRejectedEmail,
  sendEspeeProofReceivedEmail,
} from "@/lib/email"
import { sendWelcomeOnce } from "@/lib/welcome-email"
import {
  generatePaymentProofKey,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  hasPrivateResourceBucket,
  paymentProofKeyPrefix,
  R2_RESOURCE_BUCKET,
} from "@/lib/r2"
import {
  MAX_PAYMENT_PROOF_BYTES,
  PAYMENT_PROOF_TYPES,
  PAYMENT_PROOF_TYPE_ERROR,
  checkoutPathFor,
  proofContentTypeForKey,
} from "@/lib/espee"
import {
  TRANSFER_METHODS,
  nairaFor,
  transferAmountLabel,
  transferLabel,
  type NairaQuote,
  type TransferMethod,
} from "@/lib/payment-channels"

/*
 * Paying by transfer: "Pay with ESPEE" (owner meeting, 2026-10-03), and since
 * 2026-11-05 a bank transfer or USDT as well — the programme document's
 * payment details (lib/payment-channels.ts; the names here still say ESPEE).
 * The learner sends the money outside our system, uploads the receipt into the
 * PRIVATE resources bucket and submits a proof; an admin approves or rejects
 * it. Approval writes the Order and the Enrollment — the same access record a
 * wallet purchase writes — but never an instructor Earning; a partner who
 * referred the learner earns their commission as on a wallet purchase (client,
 * 2026-11-05). A bank transfer is quoted in naira at lib/naira-rate.ts's rate,
 * kept on the proof. With the private
 * bucket set, the receipt is uploaded here; without it, transfers stay open
 * and the receipt goes on WhatsApp, as the programme document asks — the proof
 * then carries the reference only. ESPEE_PAYMENT_DETAILS is no longer read:
 * the document's details are code.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/

/**
 * An approval claims the proof (`approved`) before it writes the Order and the
 * Enrollment, and links the enrollment last. A proof still `approved` with no
 * linked enrollment after this long was interrupted mid-approval (a restart or
 * a timeout) and may be approved again; every step after the claim is
 * idempotent. The wait keeps an approval that is merely slow from being
 * re-entered.
 */
const STRANDED_AFTER_MS = 2 * 60 * 1000

function isStrandedApproval(
  p: { status: ManualPaymentStatus; enrollment?: unknown; reviewedAt?: Date | null },
  now: number
): boolean {
  return (
    p.status === "approved" &&
    !p.enrollment &&
    p.reviewedAt instanceof Date &&
    now - p.reviewedAt.getTime() > STRANDED_AFTER_MS
  )
}
const PAGE_SIZE = 20
const PROOF_STATUSES = ["submitted", "approved", "rejected"] as const satisfies readonly ManualPaymentStatus[]

/**
 * Whether paying by transfer is offered. CLOSED (CTO, 2026-11-08: "All
 * payments route through WorldStreet"): checkout takes the WorldStreet wallet
 * only and a new proof is refused. Proofs sent before stay readable, and only
 * a super admin decides them.
 */
function transfersOpen(): boolean {
  // Was open from 2026-10-03 (ESPEE) and 2026-11-05 (bank, USDT); kept for the record:
  // return true
  return false
}

/** Whether the receipt is uploaded at checkout: only into the private bucket, never the public one. */
function receiptsInApp(): boolean {
  return hasPrivateResourceBucket()
}

function fullName(person: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback: string) {
  const name = `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim()
  return name || fallback
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

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
    console.error("[ESPEE] failed to log payment event", type, err)
  }
}

type QuoteErrorCode = "not_found" | "not_live" | "package_required"

/**
 * What this program and plan cost, read from the course — the same rules as
 * purchaseCourse: published, live, and an enabled package when it sells
 * packages. Nothing money-related is taken from the browser.
 */
async function quoteProgram(
  courseId: string,
  packageKey: PackageKey | undefined
): Promise<
  | { ok: true; course: ICourse; amountMinor: number; packageKey: PackageKey | null; packageName: string | null }
  | { ok: false; error: string; code: QuoteErrorCode }
> {
  const course = await Course.findOne({ _id: courseId, status: "published" })
  if (!course) return { ok: false, error: "This program isn't available", code: "not_found" }
  // The marketplace is Coming soon (MARKETPLACE_OPEN): it sells nothing.
  if (!kindIsOpen(course.kind)) return { ok: false, error: "The marketplace opens soon.", code: "not_found" }
  if (courseAvailability(course) === "coming_soon") {
    return { ok: false, error: "This program isn't live yet", code: "not_live" }
  }
  const packaged = sellsPackages(course)
  const pkg = packaged ? packageFor(course, packageKey ?? null) : null
  if (packaged && !pkg) return { ok: false, error: "Choose a plan to continue", code: "package_required" }
  const price = pkg ? pkg.price : course.pricing === "paid" ? course.price ?? 0 : 0
  return {
    ok: true,
    course,
    amountMinor: Math.round(price * 100),
    packageKey: pkg?.key ?? null,
    packageName: pkg?.name ?? null,
  }
}

/* ═══════════════════ learner ═══════════════════ */

export type EspeeProofView = {
  id: string
  /** How it was paid: ESPEE, bank or USDT. */
  method: TransferMethod
  courseId: string
  courseTitle: string
  packageKey: PackageKey | null
  packageName: string | null
  amountLabel: string
  transferReference: string
  submittedAt: string
}

export type EspeeCheckoutState = {
  /** Paying by transfer is offered. The details are lib/payment-channels.ts. */
  enabled: boolean
  /** The receipt is uploaded at checkout (private bucket set); false: it goes on WhatsApp. */
  receiptUpload: boolean
  /** The caller's proof for this program that is waiting on an admin. */
  open: EspeeProofView | null
  /** The caller's newest rejected proof for this program. */
  lastRejection: { reason: string; rejectedAt: string } | null
  /** The caller's "Who invited you?" answer, once given (first answer wins). */
  referredBy: string | null
  /** The naira rate a bank transfer is quoted at; null: none known, so the learner confirms it on WhatsApp. */
  nairaRate: NairaQuote | null
}

function proofView(
  p: {
    _id: Types.ObjectId
    method?: TransferMethod | null
    course: Types.ObjectId
    packageKey: PackageKey | null
    packageName: string | null
    amountLabel: string
    transferReference: string
    createdAt: Date
  },
  courseTitle: string
): EspeeProofView {
  return {
    id: p._id.toString(),
    method: p.method ?? "espee",
    courseId: p.course.toString(),
    courseTitle,
    packageKey: p.packageKey ?? null,
    packageName: p.packageName ?? null,
    amountLabel: p.amountLabel,
    transferReference: p.transferReference,
    submittedAt: p.createdAt.toISOString(),
  }
}

/** Everything checkout needs to offer paying by transfer for one program. Fails closed to "off". */
export async function getEspeeCheckoutState(courseId: string): Promise<EspeeCheckoutState> {
  const off: EspeeCheckoutState = {
    enabled: false,
    receiptUpload: false,
    open: null,
    lastRejection: null,
    referredBy: null,
    nairaRate: null,
  }
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user || !OBJECT_ID.test(courseId)) return off

    const [open, rejected, me, course, nairaRate] = await Promise.all([
      ManualPayment.findOne({ user: user.id, course: courseId, status: "submitted" }).lean(),
      ManualPayment.findOne({ user: user.id, course: courseId, status: "rejected" }).sort({ createdAt: -1 }).lean(),
      User.findById(user.id).select("referredBy").lean(),
      Course.findById(courseId).select("title").lean(),
      transfersOpen() ? getNairaQuote() : Promise.resolve(null),
    ])

    return {
      enabled: transfersOpen(),
      receiptUpload: receiptsInApp(),
      open: open ? proofView(open, course?.title ?? "") : null,
      lastRejection:
        rejected && rejected.reviewedAt
          ? { reason: rejected.rejectionReason ?? "", rejectedAt: rejected.reviewedAt.toISOString() }
          : null,
      referredBy: me?.referredBy?.text ?? null,
      nairaRate,
    }
  } catch (error) {
    console.error("Get ESPEE checkout state error:", error)
    return off
  }
}

const UploadInput = z.object({
  courseId: z.string().regex(OBJECT_ID, "Program not found"),
  contentType: z.string().max(100),
  sizeBytes: z
    .number()
    .int()
    .min(1, "Choose your receipt")
    .max(MAX_PAYMENT_PROOF_BYTES, "Receipts can be up to 10 MB"),
})

/**
 * A presigned PUT into the PRIVATE resources bucket, inside the caller's own
 * proofs folder. The receipt goes straight from the browser to R2; refused
 * outright while transfers are off (no private bucket).
 */
export async function getPaymentProofUploadUrl(input: {
  courseId: string
  contentType: string
  sizeBytes: number
}): Promise<{ success: true; data: { uploadUrl: string; storageKey: string } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }
    // No transfers, no receipts: never mint an upload link into the private bucket.
    if (!transfersOpen()) return { success: false, error: "Paying by transfer isn't available right now" }

    const parsed = UploadInput.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Choose your receipt" }
    const extension = PAYMENT_PROOF_TYPES[parsed.data.contentType]
    if (!extension) return { success: false, error: PAYMENT_PROOF_TYPE_ERROR }
    if (!receiptsInApp()) return { success: false, error: "Send your receipt on WhatsApp instead" }
    if (!(await Course.exists({ _id: parsed.data.courseId, status: "published" }))) {
      return { success: false, error: "This program isn't available" }
    }

    const storageKey = generatePaymentProofKey(user.id, extension)
    // The declared size is signed in as Content-Length, so a PUT of any other size fails the signature.
    const { uploadUrl } = await generatePresignedUploadUrl(
      storageKey,
      parsed.data.contentType,
      900,
      R2_RESOURCE_BUCKET,
      parsed.data.sizeBytes
    )
    return { success: true, data: { uploadUrl, storageKey } }
  } catch (error) {
    console.error("Payment proof upload URL error:", error)
    return { success: false, error: "Couldn't prepare the upload — try again" }
  }
}

const SubmitInput = z.object({
  courseId: z.string().regex(OBJECT_ID, "Program not found"),
  packageKey: z.enum(PACKAGE_KEYS).optional(),
  // A client from before bank and USDT sends no method: it was paying by ESPEE.
  method: z.enum(TRANSFER_METHODS, { error: "Choose how you paid" }).default("espee"),
  // Empty when the receipt went on WhatsApp (no private bucket); required otherwise (checked below).
  receiptKey: z.string().max(300, "Upload your receipt again").default(""),
  transferReference: z
    .string()
    .trim()
    .min(3, "Enter the reference from your receipt")
    .max(120, "Keep the reference under 120 characters"),
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
  // The naira rate the bank amount was shown at; null when checkout showed none ("confirm on WhatsApp").
  ngnPerUsd: z.number().finite().positive().nullable().default(null),
})

export type EspeeSubmitResult =
  | { success: true; data: { paymentId: string; alreadySubmitted?: boolean } }
  | {
      success: false
      error: string
      code?:
        | "auth"
        | "invalid"
        | "unavailable"
        | "already_enrolled"
        | "free"
        | "receipt"
        | "failed"
        | "rate_changed"
        | QuoteErrorCode
    }

/**
 * Submit a transfer proof (ESPEE, bank or USDT) for review. The amount is re-derived from the
 * course; the receipt must already be uploaded through getPaymentProofUploadUrl
 * — only keys inside the caller's own folder are accepted. One open proof per
 * program: a second submit gets the first one back instead of a duplicate.
 */
export async function submitEspeePayment(input: {
  courseId: string
  packageKey?: PackageKey
  method?: TransferMethod
  receiptKey: string
  transferReference: string
  note?: string
  ngnPerUsd?: number | null
}): Promise<EspeeSubmitResult> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in", code: "auth" }

    const parsed = SubmitInput.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again", code: "invalid" }
    }
    const { courseId, packageKey, method, receiptKey, transferReference } = parsed.data
    if (!transfersOpen()) {
      return { success: false, error: "Paying by transfer isn't available right now", code: "unavailable" }
    }

    const enrolled = await Enrollment.exists({
      user: user.id,
      course: courseId,
      status: { $in: ["active", "completed"] },
    })
    if (enrolled) return { success: false, error: "You're already enrolled in this program", code: "already_enrolled" }

    const open = await ManualPayment.findOne({ user: user.id, course: courseId, status: "submitted" }).select("_id").lean()
    if (open) return { success: true, data: { paymentId: open._id.toString(), alreadySubmitted: true } }

    const quote = await quoteProgram(courseId, packageKey)
    if (!quote.ok) return { success: false, error: quote.error, code: quote.code }
    if (quote.amountMinor <= 0) {
      return { success: false, error: "This course isn't on sale.", code: "free" }
    }

    // With the private bucket: only a receipt uploaded into the caller's own
    // folder, of a type we accept. Without it, no key at all (WhatsApp).
    let receiptContentType: string | null = null
    if (receiptsInApp()) {
      receiptContentType = proofContentTypeForKey(receiptKey)
      if (!receiptKey.startsWith(paymentProofKeyPrefix(user.id)) || receiptKey.includes("..") || !receiptContentType) {
        return { success: false, error: receiptKey ? "Upload your receipt again" : "Upload your receipt", code: "receipt" }
      }
    } else if (receiptKey) {
      return { success: false, error: "Send your receipt on WhatsApp instead", code: "receipt" }
    }

    // A bank transfer is asked for in naira at the rate checkout SHOWED, kept on
    // the proof so the admin checks the receipt against the figure the learner
    // sent. The rate comes from the browser, so it is stored only if this
    // server really quoted it recently (`recentlyQuotedRate`); otherwise the
    // rate has moved on, and the learner is asked to check the new amount.
    let naira: { ngnPerUsd: number; source: "pinned" | "market" } | null = null
    if (method === "bank" && parsed.data.ngnPerUsd !== null) {
      naira = await recentlyQuotedRate(parsed.data.ngnPerUsd)
      if (!naira) {
        return {
          success: false,
          error: "The naira rate changed since you opened checkout. Check the new amount before you send the payment.",
          code: "rate_changed",
        }
      }
    }
    const amountLabel = transferAmountLabel(method, quote.amountMinor, naira?.ngnPerUsd)
    // This request is the learner's, so its cookie is their partner link — approval runs in the admin's.
    const referralCode = await referralCookieCode()
    const learnerName = fullName(user, user.email)
    let paymentId: string
    try {
      const created = await ManualPayment.create({
        user: user.id,
        authUserId: user.authUserId,
        course: courseId,
        packageKey: quote.packageKey,
        packageName: quote.packageName,
        amountMinor: quote.amountMinor,
        currency: "USD",
        method,
        amountLabel,
        ngnPerUsd: naira?.ngnPerUsd ?? null,
        rateSource: naira?.source ?? null,
        amountNgn: naira ? nairaFor(quote.amountMinor, naira.ngnPerUsd) : null,
        referralCode,
        receiptKey: receiptKey || null,
        receiptContentType,
        transferReference,
        note: parsed.data.note ?? "",
        status: "submitted",
        history: [{ status: "submitted", at: new Date(), by: learnerName }],
      })
      paymentId = created._id.toString()
    } catch (error) {
      // The partial unique index caught a concurrent submit: hand back the winner.
      if (!isDuplicateKey(error)) throw error
      const winner = await ManualPayment.findOne({ user: user.id, course: courseId, status: "submitted" })
        .select("_id")
        .lean()
      if (!winner) throw error
      return { success: true, data: { paymentId: winner._id.toString(), alreadySubmitted: true } }
    }

    // Fire-and-forget: bell + email for every admin, a receipt email for the learner.
    const plan = quote.packageName ? ` — ${quote.packageName}` : ""
    void notifyAdmins({
      type: "payment",
      title: `New ${transferLabel(method)} payment to review`,
      body: `${learnerName} sent ${amountLabel} for ${quote.course.title}${plan}.`.slice(0, 500),
      href: `/admin/payments/espee/${paymentId}`,
      courseId,
    })
    void (async () => {
      const admins = await User.find({ role: "ADMIN" }).select("email").lean()
      const reviewUrl = appUrl(`/admin/payments/espee/${paymentId}`)
      await Promise.allSettled(
        admins
          .filter((a) => a.email && !a.email.endsWith("@users.noemail"))
          .map((a) =>
            sendEspeePaymentAdminEmail(a.email, {
              methodLabel: transferLabel(method),
              learnerName,
              learnerAvatarUrl: user.avatarUrl || undefined,
              courseTitle: quote.course.title,
              packageName: quote.packageName,
              amountLabel,
              transferReference,
              reviewUrl,
            })
          )
      )
    })().catch((err) => console.error("[ESPEE] admin emails failed:", err))
    void sendEspeeProofReceivedEmail({
      methodLabel: transferLabel(method),
      to: user.email ?? "",
      firstName: user.firstName ?? "",
      courseTitle: quote.course.title,
      packageName: quote.packageName,
      amountLabel,
    })

    revalidatePath("/dashboard/checkout")
    revalidatePath("/dashboard/checkout/pending")
    return { success: true, data: { paymentId } }
  } catch (error) {
    console.error("Submit ESPEE payment error:", error)
    return { success: false, error: "Couldn't send your proof — try again", code: "failed" }
  }
}

export type EspeeRejectionView = {
  courseId: string
  courseTitle: string
  amountLabel: string
  reason: string
  rejectedAt: string
  /** Back to checkout for the same program and plan. */
  checkoutPath: string
}

/** The caller's proofs waiting on an admin, and their newest rejection — the pending page's two states. */
export async function getMyEspeePayments(): Promise<{ open: EspeeProofView[]; latestRejection: EspeeRejectionView | null }> {
  const empty = { open: [], latestRejection: null }
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return empty

    const [open, rejected] = await Promise.all([
      ManualPayment.find({ user: user.id, status: "submitted" }).sort({ createdAt: -1 }).lean(),
      ManualPayment.findOne({ user: user.id, status: "rejected" }).sort({ reviewedAt: -1 }).lean(),
    ])
    const courseIds = [...open.map((p) => p.course), ...(rejected ? [rejected.course] : [])]
    const courses = await Course.find({ _id: { $in: courseIds } }).select("title").lean()
    const titles = new Map(courses.map((c) => [c._id.toString(), c.title]))

    return {
      open: open.map((p) => proofView(p, titles.get(p.course.toString()) ?? "Your program")),
      latestRejection: rejected
        ? {
            courseId: rejected.course.toString(),
            courseTitle: titles.get(rejected.course.toString()) ?? "Your program",
            amountLabel: rejected.amountLabel,
            reason: rejected.rejectionReason ?? "",
            rejectedAt: (rejected.reviewedAt ?? rejected.updatedAt).toISOString(),
            checkoutPath: checkoutPathFor(rejected.course.toString(), rejected.packageKey ?? null),
          }
        : null,
    }
  } catch (error) {
    console.error("Get my ESPEE payments error:", error)
    return empty
  }
}

const ReferralInput = z.string().trim().min(1, "Tell us who invited you").max(80, "Keep it under 80 characters")

/**
 * Checkout's optional "Who invited you?" (owner meeting 2026-10-03). Free
 * text — and when it is someone's referral code (owner, 2026-10-05), that
 * person is linked too, so their code is credited with this learner's
 * purchases. The learner's own code is refused, not saved. The first answer
 * wins: an account that already has one keeps it.
 */
export async function saveReferral(
  text: string
): Promise<{ success: true; data: { saved: boolean } } | { success: false; error: string }> {
  try {
    await connectDB()
    const user = await getCurrentUser()
    if (!user) return { success: false, error: "You need to be signed in" }

    const parsed = ReferralInput.safeParse(text)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the name" }

    const code = normalizeReferralCode(parsed.data)
    const owner = code ? await referralOwner(code) : null
    if (owner && owner.id === user.id) {
      return { success: false, error: "That's your own code — enter the person who invited you" }
    }
    const at = new Date()
    const referredBy =
      owner && code ? { text: parsed.data, at, code, userId: owner.id } : { text: parsed.data, at }

    // `referredBy: null` also matches accounts created before the field existed.
    const result = await User.updateOne({ _id: user.id, referredBy: null }, { $set: { referredBy } })
    return { success: true, data: { saved: result.modifiedCount > 0 } }
  } catch (error) {
    console.error("Save referral error:", error)
    return { success: false, error: "Couldn't save that — it won't affect your payment" }
  }
}

/* ═══════════════════ admin ═══════════════════ */

export type AdminEspeeRow = {
  id: string
  /** ESPEE, bank or USDT (older rows: ESPEE). */
  method: TransferMethod
  learnerName: string
  learnerEmail: string
  learnerAvatar: string | null
  courseTitle: string
  packageName: string | null
  amountLabel: string
  amountMinor: number
  transferReference: string
  status: ManualPaymentStatus
  createdAt: string
  reviewedAt: string | null
}

type PopulatedLearner = {
  _id?: Types.ObjectId
  firstName?: string
  lastName?: string
  email?: string
  avatarUrl?: string | null
  createdAt?: Date
  referredBy?: { text: string; at: Date } | null
} | null

function adminRow(p: {
  _id: Types.ObjectId
  method?: TransferMethod | null
  user: unknown
  course: unknown
  packageName: string | null
  amountLabel: string
  amountMinor: number
  transferReference: string
  status: ManualPaymentStatus
  createdAt: Date
  reviewedAt: Date | null
}): AdminEspeeRow {
  const learner = p.user as PopulatedLearner
  const course = p.course as { title?: string } | null
  return {
    id: p._id.toString(),
    method: p.method ?? "espee",
    learnerName: fullName(learner, learner?.email || "Unknown"),
    learnerEmail: learner?.email ?? "",
    learnerAvatar: learner?.avatarUrl || null,
    courseTitle: course?.title ?? "Program",
    packageName: p.packageName ?? null,
    amountLabel: p.amountLabel,
    amountMinor: p.amountMinor,
    transferReference: p.transferReference,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
  }
}

/** The review queue, one status at a time, newest first, with a count per status. */
export async function adminListEspeePayments(filters?: {
  status?: ManualPaymentStatus
  page?: number
}): Promise<{
  payments: AdminEspeeRow[]
  total: number
  page: number
  pageCount: number
  counts: Record<ManualPaymentStatus, number>
}> {
  const counts: Record<ManualPaymentStatus, number> = { submitted: 0, approved: 0, rejected: 0 }
  const empty = { payments: [], total: 0, page: 1, pageCount: 1, counts }
  try {
    await connectDB()
    await requireSuperAdmin()

    const status = PROOF_STATUSES.find((s) => s === filters?.status) ?? "submitted"
    const page = Math.max(1, Math.floor(filters?.page ?? 1))

    const [rows, total, countsAgg] = await Promise.all([
      ManualPayment.find({ status })
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("user", "firstName lastName email avatarUrl")
        .populate("course", "title")
        .lean(),
      ManualPayment.countDocuments({ status }),
      ManualPayment.aggregate<{ _id: ManualPaymentStatus; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ])
    for (const g of countsAgg) if (g._id in counts) counts[g._id] = g.count

    return {
      payments: rows.map(adminRow),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts,
    }
  } catch (error) {
    console.error("Admin list ESPEE payments error:", error)
    return empty
  }
}

export type AdminEspeeDetail = AdminEspeeRow & {
  learnerId: string
  learnerJoinedAt: string | null
  referredBy: { text: string; at: string } | null
  courseId: string
  packageKey: PackageKey | null
  note: string
  /** A 10-minute signed GET (inline, no download disposition); null when the private bucket is gone. */
  receiptUrl: string | null
  receiptContentType: string | null
  /** No receipt here: the learner was asked to send it on WhatsApp. */
  receiptOnWhatsApp: boolean
  rejectionReason: string | null
  reviewedByName: string
  orderReference: string | null
  /** The learner's enrollment on this program right now, whatever its status. */
  enrollmentStatus: string | null
  /** Approved, but the approval was interrupted before the program opened — approving again finishes it. */
  stranded: boolean
  history: { status: string; at: string; note?: string; by?: string }[]
  /** A bank transfer's quote: naira per $1 and whose rate it was. Null for other methods and older proofs. */
  nairaRate: { ngnPerUsd: number; source: "pinned" | "market" } | null
  /** The partner commission this payment's approval booked, if any. */
  commission: { netMinor: number; status: "pending" | "cleared" | "reversed"; note: string } | null
}

export async function adminGetEspeePayment(paymentId: string): Promise<AdminEspeeDetail | null> {
  try {
    await connectDB()
    await requireSuperAdmin()
    if (!OBJECT_ID.test(paymentId)) return null

    const p = await ManualPayment.findById(paymentId)
      .populate("user", "firstName lastName email avatarUrl createdAt referredBy")
      .populate("course", "title")
      .lean()
    if (!p) return null

    const learner = p.user as unknown as PopulatedLearner
    const learnerId = learner?._id?.toString() ?? ""
    const courseRef = p.course as unknown as { _id?: Types.ObjectId } | null
    const courseId = courseRef?._id?.toString() ?? ""

    const [reviewer, order, commission, enrollment, receiptUrl] = await Promise.all([
      p.reviewedBy ? User.findById(p.reviewedBy).select("firstName lastName email").lean() : null,
      p.order ? Order.findById(p.order).select("reference").lean() : null,
      p.order ? Earning.findOne({ kind: "referral", order: p.order }).select("netMinor status note").lean() : null,
      learnerId && courseId ? Enrollment.findOne({ user: learnerId, course: courseId }).select("status").lean() : null,
      p.receiptKey && hasPrivateResourceBucket()
        ? generatePresignedDownloadUrl(p.receiptKey, { expiresIn: 600, bucket: R2_RESOURCE_BUCKET }).catch(() => null)
        : Promise.resolve(null),
    ])

    return {
      ...adminRow(p),
      learnerId,
      learnerJoinedAt: learner?.createdAt ? new Date(learner.createdAt).toISOString() : null,
      referredBy: learner?.referredBy
        ? { text: learner.referredBy.text, at: new Date(learner.referredBy.at).toISOString() }
        : null,
      courseId,
      packageKey: p.packageKey ?? null,
      note: p.note ?? "",
      receiptUrl,
      receiptContentType: p.receiptContentType ?? null,
      receiptOnWhatsApp: !p.receiptKey,
      rejectionReason: p.rejectionReason ?? null,
      reviewedByName: reviewer ? fullName(reviewer, reviewer.email ?? "Admin") : "",
      orderReference: order?.reference ?? null,
      enrollmentStatus: enrollment?.status ?? null,
      stranded: isStrandedApproval(p, Date.now()),
      history: (p.history ?? []).map((h) => ({
        status: h.status,
        at: new Date(h.at).toISOString(),
        note: h.note,
        by: h.by,
      })),
      nairaRate: p.ngnPerUsd && p.rateSource ? { ngnPerUsd: p.ngnPerUsd, source: p.rateSource } : null,
      commission: commission ? { netMinor: commission.netMinor, status: commission.status, note: commission.note ?? "" } : null,
    }
  } catch (error) {
    console.error("Admin get ESPEE payment error:", error)
    return null
  }
}

export type EspeeApproveResult =
  | { success: true; data: { alreadyEnrolled: boolean; enrollmentId: string; orderReference: string | null } }
  | { success: false; error: string }

/**
 * Approve a proof: the learner's program opens. The claim is atomic
 * (submitted → approved in one filtered write), so a double click or a second
 * admin can never approve twice. Then, mirroring purchaseCourse: an Order
 * (paid → enrolled, paymentMethod = the proof's method, no chargeId), a PaymentEvent, and
 * the Enrollment created, activated (pre_enrolled) or restored (refunded). If
 * the enrollment can't be written, the proof goes back to `submitted` and the
 * order to `failed`.
 */
export async function adminApproveEspeePayment(paymentId: string): Promise<EspeeApproveResult> {
  try {
    await connectDB()
    const admin = await requireSuperAdmin()
    if (!OBJECT_ID.test(paymentId)) return { success: false, error: "Payment not found" }

    const proof = await ManualPayment.findById(paymentId).lean()
    if (!proof) return { success: false, error: "Payment not found" }
    // Four eyes on money: no admin approves the proof that enrolls themselves.
    if (proof.user.toString() === admin.id) {
      return { success: false, error: "Another admin has to approve your own payment" }
    }
    // …nor the one whose partner commission would be theirs: since 2026-11-05
    // an approval pays the learner's referrer from the Academy's funds. Who
    // that is: the partner link the learner had when they submitted (kept on
    // the proof — this request is the admin's, so its cookies say nothing
    // about the learner), else their saved `referredBy`. Read before any
    // write, so a failure here changes nothing.
    const referrer = await referrerFor(proof.user.toString(), normalizeReferralCode(proof.referralCode))
    if (referrer?.userId === admin.id) {
      return { success: false, error: "You referred this learner, so another admin has to approve their payment" }
    }
    const resuming = isStrandedApproval(proof, Date.now())
    if (proof.status !== "submitted" && !resuming) {
      return { success: false, error: `This payment was already ${proof.status}` }
    }

    const [course, learner, existing] = await Promise.all([
      Course.findById(proof.course).select("title instructor packages kind").lean(),
      User.findById(proof.user).select("email firstName lastName").lean(),
      Enrollment.findOne({ user: proof.user, course: proof.course }).select("status").lean(),
    ])
    if (!course || !learner) return { success: false, error: "The program or the learner no longer exists" }
    // An admin's own decision on this enrollment outranks a payment — don't override it here.
    if (existing && ["suspended", "cancelled", "expired"].includes(existing.status)) {
      return {
        success: false,
        error: `This learner's enrollment is ${existing.status}. Restore it from Enrollments, or reject this payment.`,
      }
    }
    // Already in (a wallet purchase landed first, say): approve, but leave the enrollment alone.
    const alreadyIn = existing?.status === "active" || existing?.status === "completed"

    const adminName = fullName(admin, admin.email)
    const method: TransferMethod = proof.method ?? "espee"
    const via = transferLabel(method)
    const now = new Date()
    // A resumed approval re-claims on the reviewedAt it read, so two admins
    // finishing the same stranded proof can't both run.
    const claimed = await ManualPayment.findOneAndUpdate(
      resuming
        ? { _id: proof._id, status: "approved", enrollment: null, reviewedAt: proof.reviewedAt }
        : { _id: proof._id, status: "submitted" },
      {
        $set: {
          status: "approved",
          reviewedBy: admin.id,
          reviewedAt: now,
          rejectionReason: null,
          ...(alreadyIn && existing ? { enrollment: existing._id } : {}),
        },
        $push: {
          history: {
            status: "approved",
            at: now,
            by: adminName,
            note: resuming
              ? alreadyIn
                ? "Approval finished — the learner's enrollment was already open"
                : "Approval resumed after an interrupted attempt"
              : alreadyIn
                ? "The learner already had access, so the enrollment was left as it was. Refund the transfer outside the platform if it was a duplicate."
                : `${via} payment confirmed`,
          },
        },
      },
      { new: true }
    )
    if (!claimed) return { success: false, error: "Another admin already reviewed this payment" }

    const courseId = proof.course.toString()
    const learnerId = proof.user.toString()
    if (alreadyIn && existing) {
      revalidatePath("/admin/payments/espee")
      return { success: true, data: { alreadyEnrolled: true, enrollmentId: existing._id.toString(), orderReference: null } }
    }

    const price = proof.amountMinor / 100
    const packageFields = { packageKey: proof.packageKey ?? null, packageName: proof.packageName ?? null }
    const reference = `academy_espee_${proof._id.toString()}`
    const isActivation = existing?.status === "pre_enrolled"
    const isRestore = existing?.status === "refunded"

    let order: IOrder | null = null
    let enrollmentId: string
    try {
      // The Order records how the money moved: off-platform, confirmed by this review.
      order = await Order.findOne({ reference })
      if (order) {
        // An earlier approval of this proof failed to enroll and left the order `failed`.
        await transitionOrder(order, "paid", `${via} payment re-confirmed by ${adminName}`)
      } else {
        order = await Order.create({
          user: proof.user,
          authUserId: proof.authUserId,
          course: proof.course,
          reference,
          amountMinor: proof.amountMinor,
          currency: "USD",
          packageKey: packageFields.packageKey,
          paymentMethod: method,
          status: "paid",
          chargeId: null,
          history: [
            { status: "pending", at: proof.createdAt, note: `${via} proof submitted (reference ${proof.transferReference})` },
            { status: "paid", at: now, note: `${via} payment confirmed by ${adminName}` },
          ],
        })
      }
      await ManualPayment.updateOne({ _id: proof._id }, { $set: { order: order._id } })
      await logPaymentEvent(order._id, reference, "espee_approved", {
        manualPaymentId: proof._id.toString(),
        amountMinor: proof.amountMinor,
        courseId,
        packageKey: packageFields.packageKey,
        transferReference: proof.transferReference,
        method,
        approvedBy: admin.id,
      })

      // Access unlocks here and never before. transactionId stays null: there
      // is no wallet charge, so refundEnrollment refuses it and the transfer
      // is refunded outside the platform if it ever must be.
      if (isActivation || isRestore) {
        const restored = await Enrollment.findOneAndUpdate(
          { user: proof.user, course: proof.course, status: isActivation ? "pre_enrolled" : "refunded" },
          {
            $set: {
              status: "active",
              pricePaid: price,
              currency: "USD",
              transactionId: null,
              purchasedAt: now,
              activatedAt: now,
              legacyUnpaid: false,
              ...packageFields,
            },
          },
          { new: true }
        )
        if (!restored) throw new Error("enrollment row changed concurrently")
        enrollmentId = restored._id.toString()
      } else {
        const created = await Enrollment.create({
          user: proof.user,
          course: proof.course,
          pricePaid: price,
          currency: "USD",
          transactionId: null,
          purchasedAt: now,
          activatedAt: now,
          ...packageFields,
        })
        enrollmentId = created._id.toString()
      }
    } catch (err) {
      // Nothing opened: back to the queue, so another try starts clean.
      console.error("[ESPEE] approval failed — proof returned to the queue:", err)
      if (order) {
        await transitionOrder(order, "failed", "enrollment could not be created").catch(() => {})
        await logPaymentEvent(order._id, reference, "espee_enroll_failed", {
          message: err instanceof Error ? err.message : String(err),
        })
      }
      await ManualPayment.updateOne(
        { _id: proof._id, status: "approved" },
        {
          $set: { status: "submitted", reviewedBy: null, reviewedAt: null },
          $push: {
            history: {
              status: "submitted",
              at: new Date(),
              by: adminName,
              note: "Approval rolled back — the enrollment couldn't be created",
            },
          },
        }
      ).catch((rollbackErr) => console.error("[ESPEE] rollback failed:", rollbackErr))
      return { success: false, error: "Couldn't open the program — the payment is back in the queue. Try again." }
    }

    try {
      await transitionOrder(order, "enrolled")
      await ManualPayment.updateOne({ _id: proof._id }, { $set: { enrollment: enrollmentId } })
    } catch (err) {
      console.error("[ESPEE] enrolled, but the order/proof link failed:", err)
    }

    // Who made the sale, recorded as on a wallet order (owner, 2026-10-05), from
    // the `referrer` read above. A referral earns its partner the commission,
    // as a wallet purchase does (client, 2026-11-05); the Academy pays it from
    // its own funds. Never fails the approval.
    try {
      const split = splitSale({
        kind: courseKindOf(course),
        sellerId: course.instructor.toString(),
        buyerId: learnerId,
        referrer,
      })
      if (split.attribution) {
        await Order.updateOne({ _id: order._id }, { $set: { attribution: split.attribution } })
      }
      // A link they arrived through also answers "Who invited you?" for an
      // account that has no answer yet (first answer wins), as in purchaseCourse.
      if (referrer?.source === "link") {
        await User.updateOne(
          { _id: learnerId, referredBy: null },
          { $set: { referredBy: { text: referrer.code, at: new Date(), code: referrer.code, userId: referrer.userId } } }
        ).catch((err) => console.error("[Referrals] failed to save who invited the buyer:", err))
      }
      if (split.attribution?.kind === "referral" && referrer) {
        await bookReferralCommission({
          referrer,
          buyerId: learnerId,
          orderId: order._id.toString(),
          enrollmentId,
          courseId,
          amountMinor: proof.amountMinor,
          packageKey: packageFields.packageKey,
          chargeId: null,
          via,
        })
      }
    } catch (err) {
      console.error("[ESPEE] couldn't record who made the sale:", err)
    }

    // No instructor Earning and no totalEarnings (owner meeting 2026-10-03): a
    // transfer never enters the wallet system, so there is no charge to clear
    // an instructor's share from (the referral commission above is the one
    // exception, client 2026-11-05). Only the student counts move, as in
    // purchaseCourse — pre-enrollment already counted this student.
    // Display counters only, and the seat is open: a failure is logged, never answered as "Couldn't
    // approve" (2026-11-12) — the proof is already approved, so a retry would only stop at "already approved".
    if (!isActivation) {
      try {
        await Course.findByIdAndUpdate(courseId, { $inc: { enrolledCount: 1 } })
        await User.findByIdAndUpdate(course.instructor, { $inc: { "instructorProfile.totalStudents": 1 } })
      } catch (err) {
        console.error("[ESPEE] enrolled, but the course/instructor counters didn't update:", err)
      }
    }

    // Executive (D4), as in purchaseCourse: the instructor and admins schedule onboarding.
    const pkg = packageFields.packageKey
      ? (course.packages ?? []).find((p) => p.key === packageFields.packageKey) ?? null
      : null
    if (pkg?.key === "executive" && pkg.entitlements.mentorship) {
      const buyer = fullName(learner, learner.email)
      const note = {
        type: "course" as const,
        title: `New ${pkg.name} enrollment`,
        body: `${buyer} enrolled in ${course.title} — schedule their onboarding.`,
      }
      void notifyUser(course.instructor.toString(), { ...note, href: `/instructor/courses/${courseId}`, courseId })
      void notifyAdmins({ ...note, href: `/admin/enrollments?course=${courseId}` })
    }

    void notifyUser(learnerId, {
      type: "payment",
      title: "Payment confirmed — you're enrolled",
      body: `${course.title}${packageFields.packageName ? ` — ${packageFields.packageName}` : ""} is open in your dashboard.`.slice(0, 500),
      href: `/dashboard/checkout/success?courseId=${courseId}`,
      courseId,
    })
    void sendEnrollmentConfirmationEmail({
      to: learner.email ?? "",
      firstName: learner.firstName ?? "",
      courseTitle: course.title,
      courseId,
      availableAtIso: null,
      isPaid: true,
      price,
      packageName: packageFields.packageName,
    })
    // D27: one welcome on the learner's first paid enrollment — after the confirmation, never awaited.
    void sendWelcomeOnce(learnerId, enrollmentId)

    revalidatePath("/admin/payments/espee")
    revalidatePath("/dashboard/my-courses")
    revalidatePath(`/courses/${courseId}`)
    return { success: true, data: { alreadyEnrolled: false, enrollmentId, orderReference: reference } }
  } catch (error) {
    console.error("Admin approve ESPEE payment error:", error)
    return { success: false, error: "Couldn't approve the payment — try again" }
  }
}

/* ═══════════════════ admin: the naira rate ═══════════════════ */

/** The rate card on the transfers queue: what checkout quotes, the market rate and any pin. Null when it can't be read. */
export async function adminGetNairaRate(): Promise<NairaRateAdminView | null> {
  try {
    await connectDB()
    await requireSuperAdmin()
    return await getNairaRateAdminView()
  } catch (error) {
    console.error("Admin get naira rate error:", error)
    return null
  }
}

const PinRateInput = z.object({
  ngnPerUsd: z
    .number({ error: "Enter the rate in naira per $1" })
    .finite("Enter the rate in naira per $1")
    .min(NAIRA_RATE_MIN, `The rate must be at least ₦${NAIRA_RATE_MIN}`)
    .max(NAIRA_RATE_MAX, `The rate must be under ₦${NAIRA_RATE_MAX.toLocaleString("en-US")}`)
    .nullable(),
})

/**
 * Pin the naira rate bank transfers are quoted at, or clear the pin (null) to
 * go back to the daily market rate. Proofs already submitted keep the rate
 * they were quoted.
 */
export async function adminSetNairaRate(
  ngnPerUsd: number | null
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    const admin = await requireSuperAdmin()
    const parsed = PinRateInput.safeParse({ ngnPerUsd })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the rate" }
    const rate = parsed.data.ngnPerUsd === null ? null : Math.round(parsed.data.ngnPerUsd * 100) / 100
    await setPinnedNairaRate(rate, { id: admin.id, name: fullName(admin, admin.email) })
    console.info(`[NairaRate] ${rate === null ? "pin cleared" : `pinned at ${rate}`} by admin ${admin.id}`)
    revalidatePath("/admin/payments/espee")
    revalidatePath("/dashboard/checkout")
    return { success: true }
  } catch (error) {
    console.error("Admin set naira rate error:", error)
    return { success: false, error: "Couldn't save the rate — try again" }
  }
}

const RejectInput = z.object({
  paymentId: z.string().regex(OBJECT_ID, "Payment not found"),
  reason: z
    .string()
    .trim()
    .min(5, "Tell the learner why (at least 5 characters)")
    .max(500, "Keep the reason under 500 characters"),
})

/** Reject a proof with a reason the learner reads; they may submit a new one. */
export async function adminRejectEspeePayment(
  paymentId: string,
  reason: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await connectDB()
    const admin = await requireSuperAdmin()

    const parsed = RejectInput.safeParse({ paymentId, reason })
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the reason" }

    const now = new Date()
    const rejected = await ManualPayment.findOneAndUpdate(
      { _id: parsed.data.paymentId, status: "submitted" },
      {
        $set: { status: "rejected", rejectionReason: parsed.data.reason, reviewedBy: admin.id, reviewedAt: now },
        $push: { history: { status: "rejected", at: now, by: fullName(admin, admin.email), note: parsed.data.reason } },
      },
      { new: true }
    )
    if (!rejected) {
      const current = await ManualPayment.findById(parsed.data.paymentId).select("status").lean()
      return { success: false, error: current ? `This payment was already ${current.status}` : "Payment not found" }
    }

    const courseId = rejected.course.toString()
    const [course, learner] = await Promise.all([
      Course.findById(rejected.course).select("title").lean(),
      User.findById(rejected.user).select("email firstName").lean(),
    ])
    const courseTitle = course?.title ?? "your program"
    const checkoutPath = checkoutPathFor(courseId, rejected.packageKey ?? null)

    void sendEspeePaymentRejectedEmail({
      methodLabel: transferLabel(rejected.method),
      to: learner?.email ?? "",
      firstName: learner?.firstName ?? "",
      courseTitle,
      packageName: rejected.packageName ?? null,
      amountLabel: rejected.amountLabel,
      reason: parsed.data.reason,
      checkoutUrl: appUrl(checkoutPath),
    })
    void notifyUser(rejected.user.toString(), {
      type: "payment",
      title: "Payment not confirmed",
      body: `${courseTitle}: ${parsed.data.reason}`.slice(0, 500),
      href: checkoutPath,
      courseId,
    })

    revalidatePath("/admin/payments/espee")
    revalidatePath("/dashboard/checkout/pending")
    return { success: true }
  } catch (error) {
    console.error("Admin reject ESPEE payment error:", error)
    return { success: false, error: "Couldn't reject the payment — try again" }
  }
}
