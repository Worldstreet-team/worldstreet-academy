import { NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/db"
import type { Types } from "mongoose"
import { Earning, Enrollment, type IEarning } from "@/lib/db/models"
import { createWalletCredit, createWalletCharge, isInsufficientBalance, walletEnabled, WalletError } from "@/lib/wallet"
import { bookMissingReferralCommissions } from "@/lib/referrals"

/**
 * Claims a matured earning for its payout (2026-11-12), the same rule as the
 * lazy pass in lib/actions/earnings.ts: "cleared" is written BEFORE the money
 * moves, and only while it is still "pending", so a cancellation (it reverses
 * only pending earnings) or a refund (it books a clawback for a cleared one)
 * landing meanwhile can't strand a credit already on its way. The shared model
 * has no "clearing" status, so "cleared" is the claim. Null: taken already.
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
 * The wallet didn't pay a claimed earning: back to "pending" for the next run,
 * which replays the same reference. On the wallet's own refusal no money
 * moved, so a clawback a refund booked while it was claimed is void: both are
 * reversed. After an unconfirmed answer the clawback stands.
 */
async function releaseEarningClaim(earning: IEarning, claimedAt: Date, err: unknown): Promise<void> {
  await Earning.updateOne(
    { _id: earning._id, status: "cleared", clearedAt: claimedAt },
    { $set: { status: "pending", clearedAt: null } }
  )
  const clawback = await Earning.findOne({ creditReference: `academy_clawback_${earning._id.toString()}` })
    .select("_id")
    .lean()
  if (!clawback) return
  const refused = err instanceof WalletError && err.status < 500 && err.code !== "WALLET_UNAVAILABLE"
  if (!refused) {
    console.error("[Cron] refunded while its payout was unconfirmed — check the wallet:", earning._id.toString())
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
 * Scheduled earnings clearing — the cron counterpart to the lazy pass inside
 * getMyInstructorEarnings(), so matured earnings clear even when the
 * instructor never opens their dashboard.
 *
 * Wire it as a Coolify scheduled task (~every 15 min):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://academy.worldstreetgold.com/api/cron/earnings
 *
 * Idempotent by construction: wallet credits dedupe on creditReference and
 * clawback charges carry the same reference as their Idempotency-Key.
 *
 * Every kind clears here: sale shares, referral commissions (owner,
 * 2026-10-05) and clawbacks. `instructorAuthUserId` is simply the earner's
 * wallet subject — a referrer may be a plain USER, and nothing here reads a
 * role.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization") ?? ""
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  if (!walletEnabled()) {
    return NextResponse.json({ ok: false, error: "wallet_disabled" }, { status: 503 })
  }

  await connectDB()

  // First, book any referral commission a purchase or transfer approval failed
  // to write (2026-11-08). Booked pending, so it still waits out the clearing
  // window; idempotent on the order's credit reference.
  const commissionsBooked = await bookMissingReferralCommissions().catch((err) => {
    console.error("[Earnings] missing-commission pass failed:", err)
    return 0
  })

  const matured = await Earning.find({
    status: "pending",
    availableAt: { $lte: new Date() },
  })
    .populate("course", "title")
    .sort({ availableAt: 1 })
    .limit(200)

  // Never pay out a share of a purchase that was refunded or cancelled
  // (2026-11-12). The refund or cancellation reverses its pending earnings; if
  // that write failed, the earning is still pending here, and stays so.
  const payable = matured.filter((e) => e.netMinor > 0 && e.enrollment).map((e) => e.enrollment)
  const heldIds = new Set(
    payable.length > 0
      ? (
          await Enrollment.find({ _id: { $in: payable }, status: { $in: ["refunded", "cancelled"] } })
            .select("_id")
            .lean()
        ).map((r) => String(r._id))
      : []
  )

  let cleared = 0
  let skippedInsufficient = 0
  let failed = 0
  let held = 0

  for (const earning of matured) {
    const courseTitle = (earning.course as unknown as { title?: string })?.title ?? "course"
    if (earning.netMinor > 0 && earning.enrollment && heldIds.has(String(earning.enrollment))) {
      held++
      console.error("[Cron] not clearing an earning of a refunded or cancelled enrollment:", earning._id.toString())
      continue
    }
    // Claimed before the money moves (2026-11-12); the lazy pass, a cancellation or a refund may have it.
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
      cleared++
    } catch (err) {
      await releaseEarningClaim(earning, claimedAt, err).catch((releaseErr) =>
        console.error("[Cron] couldn't release a claimed earning:", earning._id.toString(), releaseErr)
      )
      if (isInsufficientBalance(err)) {
        // Clawback exceeds the instructor's balance — retries next run.
        skippedInsufficient++
        continue
      }
      failed++
      console.error("[Cron] earnings clearing failed for", earning._id.toString(), err)
    }
  }

  return NextResponse.json({
    ok: true,
    commissionsBooked,
    matured: matured.length,
    cleared,
    skippedInsufficient,
    held,
    failed,
  })
}
