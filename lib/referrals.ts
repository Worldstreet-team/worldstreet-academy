import "server-only"
import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { Types } from "mongoose"
import {
  Earning,
  Order,
  User,
  INSTRUCTOR_REVENUE_SHARE,
  MARKETPLACE_SHARE_ACADEMY,
  MARKETPLACE_SHARE_OWN_LINK,
  type CourseKind,
  type OrderAttributionKind,
} from "@/lib/db/models"
import { REFERRAL_COOKIE, normalizeReferralCode } from "@/lib/referral-link"
import { maskedName } from "@/lib/masked-name"

/**
 * Server half of referrals (owner, 2026-10-05): minting a person's code, who
 * invited a buyer, who made a sale and what its seller keeps, and the one
 * commission a referred person can earn their referrer. Client-safe rules
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
 * courses are free and follow the program row. The 10% commission is decided
 * apart from this (`isFirstPaidPurchase`): only ever on a "referral" sale, so
 * never on one the seller's own link made. With no code, or when this can't
 * be decided, the sale is the Academy's — the "no code" rows.
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
 * The credit reference of a buyer's referral commission. One per BUYER, not
 * per enrollment: the unique index on `creditReference` makes "only the
 * referred person's first paid enrollment, ever" a database guarantee, and a
 * duplicate-key error on create means the commission was already paid.
 */
export function referralCreditReference(buyerId: string): string {
  return `academy_ref_${buyerId}`
}

/**
 * Whether order `orderId` is the buyer's first paid enrollment, ever: no
 * other order of theirs is paid or enrolled (an ESPEE order counts), and no
 * referral commission has ever named them as the student — even a reversed one.
 */
export async function isFirstPaidPurchase(buyerId: string, orderId: string): Promise<boolean> {
  const [otherPaid, priorCommission] = await Promise.all([
    Order.exists({ user: buyerId, _id: { $ne: orderId }, status: { $in: ["paid", "enrolled"] } }),
    Earning.exists({ kind: "referral", student: buyerId }),
  ])
  return !otherPaid && !priorCommission
}

/* ═══════════════════ the referrals page ═══════════════════ */

/** "refunded": the purchase was refunded, so the commission was reversed or clawed back. */
export type ReferralCommissionStatus = "pending" | "cleared" | "refunded"

export type ReferralPerson = {
  id: string
  /** First name + last initial — never an email. */
  name: string
  joinedAt: string
  /** Has a paid or enrolled order. */
  paid: boolean
  commission: { status: ReferralCommissionStatus; netMinor: number; availableAt: string } | null
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
  /** Newest first. */
  people: ReferralPerson[]
}

/** Everything `/dashboard/referrals` shows `userId` — their code is minted here on first visit. */
export async function referralSummary(userId: string, limit = 25): Promise<ReferralSummary> {
  const code = await ensureReferralCode(userId)
  const me = new Types.ObjectId(userId)

  const [referred, commissions] = await Promise.all([
    User.find({ "referredBy.userId": me }).select("_id firstName lastName createdAt").sort({ createdAt: -1 }).lean(),
    Earning.find({ instructor: me, kind: "referral" }).select("_id student netMinor status availableAt").lean(),
  ])
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
  const byStudent = new Map<string, ReferralPerson["commission"]>()
  for (const c of commissions) {
    if (c.status === "pending") pendingMinor += c.netMinor
    if (c.status === "cleared") clearedMinor += c.netMinor
    const status: ReferralCommissionStatus =
      c.status === "pending" ? "pending" : c.status === "cleared" && !clawedBack.has(c._id.toString()) ? "cleared" : "refunded"
    if (c.student) {
      byStudent.set(c.student.toString(), { status, netMinor: c.netMinor, availableAt: c.availableAt.toISOString() })
    }
  }

  return {
    code,
    referredCount: referred.length,
    paidCount: referred.filter((u) => paid.has(u._id.toString())).length,
    pendingMinor,
    clearedMinor,
    people: referred.slice(0, limit).map((u) => ({
      id: u._id.toString(),
      name: maskedName(u.firstName, u.lastName),
      joinedAt: u.createdAt.toISOString(),
      paid: paid.has(u._id.toString()),
      commission: byStudent.get(u._id.toString()) ?? null,
    })),
  }
}
