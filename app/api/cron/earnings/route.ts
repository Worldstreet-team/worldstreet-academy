import { NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/db"
import { Earning } from "@/lib/db/models"
import { createWalletCredit, createWalletCharge, isInsufficientBalance, walletEnabled } from "@/lib/wallet"

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

  const matured = await Earning.find({
    status: "pending",
    availableAt: { $lte: new Date() },
  })
    .populate("course", "title")
    .sort({ availableAt: 1 })
    .limit(200)

  let cleared = 0
  let skippedInsufficient = 0
  let failed = 0

  for (const earning of matured) {
    const courseTitle = (earning.course as unknown as { title?: string })?.title ?? "course"
    try {
      if (earning.netMinor >= 0) {
        await createWalletCredit(earning.instructorAuthUserId, {
          amountMinor: earning.netMinor,
          reference: earning.creditReference,
          description: `Academy earnings: ${courseTitle}`,
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
      earning.status = "cleared"
      earning.clearedAt = new Date()
      await earning.save()
      cleared++
    } catch (err) {
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
    matured: matured.length,
    cleared,
    skippedInsufficient,
    failed,
  })
}
