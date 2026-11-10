import "server-only"
import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { Types } from "mongoose"
import {
  Earning,
  Enrollment,
  Order,
  PartnerClick,
  User,
  EARNINGS_CLEARING_DAYS,
  INSTRUCTOR_REVENUE_SHARE,
  MARKETPLACE_SHARE_ACADEMY,
  MARKETPLACE_SHARE_OWN_LINK,
  referralRateFor,
  type CourseKind,
  type OrderAttributionKind,
  type PackageKey,
} from "@/lib/db/models"
import { REFERRAL_COOKIE, SELLER_LINK_COOKIE, normalizeReferralCode, sellerLinkCodeFor } from "@/lib/referral-link"
import { maskedName } from "@/lib/masked-name"
import { PARTNER_CLICK_WINDOW_DAYS, partnerDay, recentDays, type PartnerClickDay } from "@/lib/partner-clicks"

/**
 * Server half of referrals (owner, 2026-10-05): minting a person's code, who
 * invited a buyer, who made a sale and what its seller keeps, and the
 * commission each of a referred person's purchases earns their referrer
 * (client, 2026-11-05: every purchase, however it was paid). Client-safe rules
 * (cookie, normalizing, links) are in lib/referral-link.ts. Callers have
 * already run connectDB().
 */

/** Crockford base32 — nothing to misread when a code is said aloud. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

function randomSuffix(length: number): string {
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) out += CROCKFORD[bytes[i] % 32]
  return out
}

/** "ADA-7K2Q": up to 8 letters of the first name (or "WSA"), a dash, 4 random symbols. */
function candidateCode(firstName: string | null | undefined): string {
  const stem = (firstName ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8)
  return `${stem.length >= 2 ? stem : "WSA"}-${randomSuffix(4)}`
}

/**
 * The person's referral code, minted on first use. Only ever set when empty
 * (the filter pins `referralCode: null`), so a code never changes once shared;
 * a collision on the unique index just tries another candidate.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await User.findById(userId).select("referralCode firstName").lean()
  if (!existing) throw new Error("User not found")
  if (existing.referralCode) return existing.referralCode

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = candidateCode(existing.firstName)
    try {
      const updated = await User.findOneAndUpdate(
        { _id: userId, referralCode: null },
        { $set: { referralCode: code } },
        { new: true }
      )
        .select("referralCode")
        .lean()
      if (updated?.referralCode) return updated.referralCode
      // Someone else minted it first (another tab) — read theirs.
      const now = await User.findById(userId).select("referralCode").lean()
      if (now?.referralCode) return now.referralCode
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err
    }
  }
  throw new Error("Could not mint a referral code")
}

/** The owner of a code, or null. */
export async function referralOwner(code: string): Promise<{ id: string; authUserId: string } | null> {
  const owner = await User.findOne({ referralCode: code }).select("_id authUserId").lean()
  return owner ? { id: owner._id.toString(), authUserId: owner.authUserId } : null
}

/** The code in this request's `wsa_ref` cookie, or null (also outside a request). */
export async function referralCookieCode(): Promise<string | null> {
  try {
    return normalizeReferralCode((await cookies()).get(REFERRAL_COOKIE)?.value)
  } catch {
    return null
  }
}

/** The code this request's buyer last followed on `slug`'s own page, or null. */
export async function sellerLinkCookieCode(slug: string): Promise<string | null> {
  try {
    return sellerLinkCodeFor((await cookies()).get(SELLER_LINK_COOKIE)?.value, slug)
  } catch {
    return null
  }
}

/* ═══════════════════ who invited a buyer ═══════════════════ */

/** Someone whose code a sale can be credited to. */
export type Referrer = {
  userId: string
  authUserId: string
  code: string
  firstName: string
  lastName: string
  /** "link": the buyer's `wsa_ref` cookie. "account": the buyer's saved `referredBy`. */
  source: "link" | "account"
}

const REFERRER_FIELDS = "_id authUserId firstName lastName referralCode"

function asReferrer(
  doc: { _id: Types.ObjectId; authUserId: string; firstName?: string | null; lastName?: string | null },
  code: string,
  source: Referrer["source"]
): Referrer {
  return {
    userId: doc._id.toString(),
    authUserId: doc.authUserId,
    code,
    firstName: doc.firstName ?? "",
    lastName: doc.lastName ?? "",
    source,
  }
}

/**
 * Who invited `buyerId`: the owner of `linkCode` (the buyer's own `wsa_ref`
 * cookie) first, else the person their account names in `referredBy`. Never
 * the buyer themselves; null when nobody. Pass `linkCode: null` whenever the
 * request isn't the buyer's — an admin approving an ESPEE proof carries the
 * admin's cookies, not the learner's.
 */
export async function referrerFor(buyerId: string, linkCode: string | null): Promise<Referrer | null> {
  if (linkCode) {
    const owner = await User.findOne({ referralCode: linkCode }).select(REFERRER_FIELDS).lean()
    if (owner && owner._id.toString() !== buyerId) return asReferrer(owner, linkCode, "link")
  }
  const buyer = await User.findById(buyerId).select("referredBy").lean()
  const saved = buyer?.referredBy
  if (!saved?.userId || saved.userId.toString() === buyerId) return null
  const owner = await User.findById(saved.userId).select(REFERRER_FIELDS).lean()
  if (!owner) return null
  const code = saved.code ?? owner.referralCode ?? null
  return code ? asReferrer(owner, code, "account") : null
}

/* ═══════════════════ who made the sale ═══════════════════ */

export type SaleAttribution = { code: string; userId: string; kind: OrderAttributionKind }

export type SaleSplit = {
  /** The seller's (instructor's) share of the sale, 0–1. The Academy keeps the rest. */
  share: number
  attribution: SaleAttribution | null
}

/**
 * Who made a sale and what its seller keeps (owner, 2026-10-05). Pure.
 *
 *   course        the code's owner       attribution   seller keeps
 *   marketplace   the course's seller    seller_link   85%
 *   marketplace   anyone else            referral      50%
 *   marketplace   no code                —             50%
 *   program       anyone                 referral      85%
 *   program       no code                —             85%
 *
 * A code the buyer owns is ignored: never a self-referral. "New economy"
 * courses follow the program row. The commission is booked apart from this
 * (`bookReferralCommission`): only ever on a "referral" sale, so never on one
 * the seller's own link made. With no code, or when this can't be decided,
 * the sale is the Academy's — the "no code" rows.
 */
export function splitSale(input: {
  kind: CourseKind
  sellerId: string
  buyerId: string
  referrer: Referrer | null
}): SaleSplit {
  const ref = input.referrer && input.referrer.userId !== input.buyerId ? input.referrer : null
  const referral: SaleAttribution | null = ref ? { code: ref.code, userId: ref.userId, kind: "referral" } : null
  if (input.kind === "marketplace") {
    if (ref && ref.userId === input.sellerId) {
      return {
        share: MARKETPLACE_SHARE_OWN_LINK,
        attribution: { code: ref.code, userId: ref.userId, kind: "seller_link" },
      }
    }
    return { share: MARKETPLACE_SHARE_ACADEMY, attribution: referral }
  }
  return { share: INSTRUCTOR_REVENUE_SHARE, attribution: referral }
}

/* ═══════════════════ the referral commission ═══════════════════ */

/**
 * The credit reference of the commission order `orderId` earns. One per ORDER
 * (client, 2026-11-05: every purchase earns, not only the first), so the
 * unique index on `creditReference` makes a replayed purchase or a resumed
 * transfer approval book it once. Commissions booked before that change carry
 * `academy_ref_<buyerId>`, one per buyer.
 */
export function referralCreditReference(orderId: string): string {
  return `academy_ref_order_${orderId}`
}

/**
 * Book the referral commission one paid order earns its referrer: the plan's
 * share (`referralRateFor` — Basic 10%, Standard 12%, Executive 15%; 10%
 * without a plan), pending through the clearing window, then credited to the
 * referrer's WorldStreet wallet (its USD balance) by /api/cron/earnings; it
 * pays for programs, and USD withdrawal isn't open yet (2026-11-08). Every
 * purchase earns (client, 2026-11-05), whatever the
 * way it was paid: a wallet purchase (`purchaseCourse`), or a transfer once an
 * admin confirms it (`adminApproveEspeePayment`). On a transfer the money sits
 * in the Academy's bank or crypto account, so the Academy pays it from its own
 * funds. Never a self-referral. Callers book it only on a "referral" sale.
 * Never throws: the money has already moved, so a failure is logged.
 */
export async function bookReferralCommission(input: {
  referrer: Referrer
  buyerId: string
  orderId: string
  enrollmentId: string
  courseId: string
  amountMinor: number
  packageKey: PackageKey | null
  /** The wallet charge; null on a transfer. */
  chargeId: string | null
  /** How the learner paid, for the ledger note: "wallet", "Bank transfer" … */
  via: string
}): Promise<void> {
  const { referrer, buyerId, packageKey } = input
  if (referrer.userId === buyerId) return
  const rate = referralRateFor(packageKey)
  const commissionMinor = Math.round(input.amountMinor * rate)
  if (commissionMinor <= 0) return
  // Two tries: a passing database error shouldn't cost the referrer this
  // commission. A miss after both is booked by the earnings cron's
  // `bookMissingReferralCommissions` pass; the reference keeps either one-off.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await Earning.create({
        enrollment: input.enrollmentId,
        order: input.orderId,
        course: input.courseId,
        instructor: referrer.userId,
        instructorAuthUserId: referrer.authUserId,
        student: buyerId,
        kind: "referral",
        grossMinor: input.amountMinor,
        feeMinor: input.amountMinor - commissionMinor,
        netMinor: commissionMinor,
        currency: "USD",
        status: "pending",
        availableAt: new Date(Date.now() + EARNINGS_CLEARING_DAYS * 24 * 60 * 60 * 1000),
        creditReference: referralCreditReference(input.orderId),
        chargeId: input.chargeId,
        note: `referral: ${Math.round(rate * 100)}% of a referred learner's purchase${packageKey ? ` (${packageKey})` : ""}, paid by ${input.via}, code ${referrer.code}`,
      })
      return
    } catch (err) {
      // A duplicate reference is this order's commission, already booked.
      if ((err as { code?: number }).code === 11000) return
      console.error(`[Referrals] failed to record the referral commission (try ${attempt} of 2):`, err)
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500))
    }
  }
}

/** The ledger note's "paid by …" for an order's payment method. */
const PAID_BY: Record<string, string> = {
  wallet: "wallet",
  espee: "ESPEE transfer",
  bank: "bank transfer",
  usdt_trc20: "USDT (TRC20)",
  usdt_bep20: "USDT (BEP20)",
}

/**
 * Books the commission a referred, enrolled order is missing (2026-11-08).
 * `bookReferralCommission` never throws (the money has already moved), so a
 * write that failed during a purchase or a transfer approval was only logged;
 * /api/cron/earnings runs this before it clears, and the order's credit
 * reference makes it book once. Only orders since the first per-order
 * commission was ever booked: before that, production followed the old
 * first-purchase-only rule (`academy_ref_<buyerId>`), and those orders must
 * not start earning now. Skips an enrollment that no longer grants access
 * (refunded or cancelled). Returns how many it booked.
 */
export async function bookMissingReferralCommissions(limit = 100): Promise<number> {
  const first = await Earning.findOne({ kind: "referral", creditReference: /^academy_ref_order_/ })
    .sort({ createdAt: 1 })
    .select("order createdAt")
    .lean()
  if (!first) return 0
  const firstOrder = first.order ? await Order.findById(first.order).select("createdAt").lean() : null
  const since = firstOrder?.createdAt ?? first.createdAt

  const orders = await Order.find({ status: "enrolled", "attribution.kind": "referral", createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(500)
    .select("_id user course amountMinor packageKey chargeId paymentMethod attribution")
    .lean()
  if (orders.length === 0) return 0
  const have = await Earning.find({ creditReference: { $in: orders.map((o) => referralCreditReference(String(o._id))) } })
    .select("creditReference")
    .lean()
  const booked = new Set(have.map((e) => e.creditReference))

  let count = 0
  for (const o of orders) {
    if (count >= limit) break
    const reference = referralCreditReference(String(o._id))
    if (booked.has(reference) || !o.attribution?.userId) continue
    try {
      const [owner, enrollment] = await Promise.all([
        User.findById(o.attribution.userId).select(REFERRER_FIELDS).lean(),
        Enrollment.findOne({ user: o.user, course: o.course, status: { $in: ["active", "completed"] } }).select("_id").lean(),
      ])
      if (!owner?.authUserId || !enrollment) continue
      await bookReferralCommission({
        referrer: {
          userId: String(owner._id),
          authUserId: owner.authUserId,
          code: o.attribution.code,
          firstName: owner.firstName ?? "",
          lastName: owner.lastName ?? "",
          source: "account",
        },
        buyerId: String(o.user),
        orderId: String(o._id),
        enrollmentId: String(enrollment._id),
        courseId: String(o.course),
        amountMinor: o.amountMinor,
        packageKey: o.packageKey ?? null,
        chargeId: o.chargeId ?? null,
        via: PAID_BY[o.paymentMethod ?? "wallet"] ?? "wallet",
      })
      if (await Earning.exists({ creditReference: reference })) {
        count++
        console.info("[Referrals] booked a missing commission for order", String(o._id))
      }
    } catch (err) {
      console.error("[Referrals] couldn't book a missing commission for order", String(o._id), err)
    }
  }
  return count
}

/* ═══════════════════ the referrals page ═══════════════════ */

export type ReferralPerson = {
  id: string
  /** First name + last initial — never an email. */
  name: string
  joinedAt: string
  /** Has a paid or enrolled order. */
  paid: boolean
  /** What their purchases earned you, one commission per purchase; null when none has. */
  commission: {
    /** Still in the clearing window, and when the soonest of those clears. */
    pendingMinor: number
    nextClearsAt: string | null
    /** Credited to your wallet and not clawed back. */
    paidMinor: number
    /** Commissions whose purchase was refunded. */
    refunded: number
  } | null
}

export type ReferralSummary = {
  code: string
  /** Users whose `referredBy.userId` is this person. */
  referredCount: number
  /** Of those, the ones with a paid or enrolled order. */
  paidCount: number
  /** Commissions still in the clearing window. */
  pendingMinor: number
  /** Commissions credited to the wallet, less any clawed back after a refund. */
  clearedMinor: number
  /** Visits to this code's partner link: all time, and per Lagos day for the last 30 (newest first, empty days 0). */
  clicks: { total: number; last30: PartnerClickDay[] }
  /** What learners paid for purchases credited to this code as a referral: paid or enrolled orders, wallet and transfers; not refunds, not a creator's own link. */
  revenueMinor: number
  /** Newest first. */
  people: ReferralPerson[]
}

/** Everything `/dashboard/referrals` shows `userId` — their code is minted here on first visit. */
export async function referralSummary(userId: string, limit = 25): Promise<ReferralSummary> {
  const code = await ensureReferralCode(userId)
  const me = new Types.ObjectId(userId)

  const days = recentDays(partnerDay(new Date()), PARTNER_CLICK_WINDOW_DAYS)

  const [referred, commissions, clickTotals, clickRows, revenue] = await Promise.all([
    User.find({ "referredBy.userId": me }).select("_id firstName lastName createdAt").sort({ createdAt: -1 }).lean(),
    Earning.find({ instructor: me, kind: "referral" }).select("_id student netMinor status availableAt").lean(),
    PartnerClick.aggregate<{ total: number }>([{ $match: { code } }, { $group: { _id: null, total: { $sum: "$count" } } }]),
    PartnerClick.find({ code, day: { $gte: days[days.length - 1] } }).select("day count").lean(),
    Order.aggregate<{ total: number }>([
      { $match: { "attribution.userId": me, "attribution.kind": "referral", status: { $in: ["paid", "enrolled"] } } },
      { $group: { _id: null, total: { $sum: "$amountMinor" } } },
    ]),
  ])
  const countByDay = new Map(clickRows.map((r) => [r.day, r.count]))
  const [clawbacks, paidUserIds] = await Promise.all([
    // refundEnrollment keys a post-clearing clawback on the earning it reverses.
    commissions.length
      ? Earning.find({
          instructor: me,
          kind: "adjustment",
          creditReference: { $in: commissions.map((c) => `academy_clawback_${c._id.toString()}`) },
          status: { $ne: "reversed" },
        })
          .select("creditReference netMinor")
          .lean()
      : Promise.resolve([]),
    referred.length
      ? Order.distinct("user", { user: { $in: referred.map((u) => u._id) }, status: { $in: ["paid", "enrolled"] } })
      : Promise.resolve([]),
  ])

  const clawedBack = new Set(clawbacks.map((c) => c.creditReference.replace("academy_clawback_", "")))
  const paid = new Set(paidUserIds.map((id) => String(id)))

  let pendingMinor = 0
  let clearedMinor = clawbacks.reduce((sum, c) => sum + c.netMinor, 0)
  const byStudent = new Map<string, NonNullable<ReferralPerson["commission"]>>()
  for (const c of commissions) {
    if (c.status === "pending") pendingMinor += c.netMinor
    if (c.status === "cleared") clearedMinor += c.netMinor
    if (!c.student) continue
    const key = c.student.toString()
    const row = byStudent.get(key) ?? { pendingMinor: 0, nextClearsAt: null, paidMinor: 0, refunded: 0 }
    if (c.status === "pending") {
      row.pendingMinor += c.netMinor
      const at = c.availableAt.toISOString()
      if (!row.nextClearsAt || at < row.nextClearsAt) row.nextClearsAt = at
    } else if (c.status === "cleared" && !clawedBack.has(c._id.toString())) {
      row.paidMinor += c.netMinor
    } else {
      // Reversed before clearing, or clawed back after: the purchase was refunded.
      row.refunded += 1
    }
    byStudent.set(key, row)
  }

  return {
    code,
    referredCount: referred.length,
    paidCount: referred.filter((u) => paid.has(u._id.toString())).length,
    pendingMinor,
    clearedMinor,
    clicks: {
      total: clickTotals[0]?.total ?? 0,
      last30: days.map((d) => ({ day: d, count: countByDay.get(d) ?? 0 })),
    },
    revenueMinor: revenue[0]?.total ?? 0,
    people: referred.slice(0, limit).map((u) => ({
      id: u._id.toString(),
      name: maskedName(u.firstName, u.lastName),
      joinedAt: u.createdAt.toISOString(),
      paid: paid.has(u._id.toString()),
      commission: byStudent.get(u._id.toString()) ?? null,
    })),
  }
}

/* ═══════════════════ the admin partners table ═══════════════════ */

export type PartnerRow = {
  userId: string
  code: string
  firstName: string
  lastName: string
  email: string
  role: "USER" | "INSTRUCTOR" | "ADMIN"
  clicks: number
  signUps: number
  enrolled: number
  revenueMinor: number
  commissionPendingMinor: number
  commissionPaidMinor: number
}

/**
 * Every Partner Code holder with any activity, best first; `inactive` counts the
 * holders with none. A fixed number of queries, whatever the number of partners;
 * the commission arithmetic mirrors `referralSummary`.
 */
export async function partnerRows(): Promise<{ rows: PartnerRow[]; inactive: number }> {
  const holders = await User.find({ referralCode: { $type: "string" } })
    .select("_id firstName lastName email role referralCode")
    .lean()

  const [clickTotals, referredUsers, revenue, commissions] = await Promise.all([
    PartnerClick.aggregate<{ _id: string; total: number }>([{ $group: { _id: "$code", total: { $sum: "$count" } } }]),
    User.find({ "referredBy.userId": { $type: "objectId" } })
      .select("_id referredBy.userId")
      .lean(),
    Order.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { "attribution.kind": "referral", status: { $in: ["paid", "enrolled"] } } },
      { $group: { _id: "$attribution.userId", total: { $sum: "$amountMinor" } } },
    ]),
    Earning.find({ kind: "referral" }).select("_id instructor netMinor status").lean(),
  ])

  const [paidUserIds, clawbacks] = await Promise.all([
    referredUsers.length
      ? Order.distinct("user", { user: { $in: referredUsers.map((u) => u._id) }, status: { $in: ["paid", "enrolled"] } })
      : Promise.resolve([]),
    commissions.length
      ? Earning.find({
          kind: "adjustment",
          creditReference: { $in: commissions.map((c) => `academy_clawback_${c._id.toString()}`) },
          status: { $ne: "reversed" },
        })
          .select("instructor netMinor")
          .lean()
      : Promise.resolve([]),
  ])

  const clicksByCode = new Map(clickTotals.map((c) => [c._id, c.total]))
  const revenueByUser = new Map(revenue.map((r) => [String(r._id), r.total]))
  const paid = new Set(paidUserIds.map((id) => String(id)))
  const signUps = new Map<string, number>()
  const enrolled = new Map<string, number>()
  for (const u of referredUsers) {
    const owner = String(u.referredBy?.userId)
    signUps.set(owner, (signUps.get(owner) ?? 0) + 1)
    if (paid.has(u._id.toString())) enrolled.set(owner, (enrolled.get(owner) ?? 0) + 1)
  }
  const pending = new Map<string, number>()
  const cleared = new Map<string, number>()
  for (const c of commissions) {
    const owner = String(c.instructor)
    if (c.status === "pending") pending.set(owner, (pending.get(owner) ?? 0) + c.netMinor)
    if (c.status === "cleared") cleared.set(owner, (cleared.get(owner) ?? 0) + c.netMinor)
  }
  for (const c of clawbacks) {
    const owner = String(c.instructor)
    cleared.set(owner, (cleared.get(owner) ?? 0) + c.netMinor)
  }

  const all = holders.map((h): PartnerRow => {
    const id = h._id.toString()
    return {
      userId: id,
      code: h.referralCode as string,
      firstName: h.firstName,
      lastName: h.lastName,
      email: h.email,
      role: h.role,
      clicks: clicksByCode.get(h.referralCode as string) ?? 0,
      signUps: signUps.get(id) ?? 0,
      enrolled: enrolled.get(id) ?? 0,
      revenueMinor: revenueByUser.get(id) ?? 0,
      commissionPendingMinor: pending.get(id) ?? 0,
      commissionPaidMinor: cleared.get(id) ?? 0,
    }
  })

  const rows = all
    .filter((r) => r.clicks > 0 || r.signUps > 0 || r.revenueMinor > 0 || r.commissionPendingMinor !== 0 || r.commissionPaidMinor !== 0)
    .sort(
      (a, b) =>
        b.revenueMinor - a.revenueMinor ||
        b.commissionPendingMinor + b.commissionPaidMinor - (a.commissionPendingMinor + a.commissionPaidMinor) ||
        b.clicks - a.clicks ||
        a.code.localeCompare(b.code),
    )
  return { rows, inactive: all.length - rows.length }
}
