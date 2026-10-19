"use server"

import { cookies, headers } from "next/headers"
import { z } from "zod/v4"
import connectDB from "@/lib/db"
import { PartnerClick } from "@/lib/db/models"
import { getCurrentUser } from "@/lib/auth"
import { referralOwner } from "@/lib/referrals"
import { normalizeReferralCode } from "@/lib/referral-link"
import { PARTNER_SEEN_COOKIE, isBotUserAgent, partnerDay, seenCodes, withSeenCode } from "@/lib/partner-clicks"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

const codeSchema = z.string().max(64)

/**
 * Counts one WMA Partners link visit (D28): once per visitor per code per
 * Lagos day, into `partnerclicks`. Phase 18 ruling 3: the cheap rejections
 * (shape, bots, already counted today) run before connectDB() so a crawler or
 * a reload costs no database round trip, and there is no revalidatePath —
 * nothing cached shows clicks. Ignored visits answer exactly like counted
 * ones, so the action reveals nothing about which codes exist.
 */
export async function recordPartnerVisit(
  code: string
): Promise<{ success: true; data: null } | { success: false; error: string }> {
  try {
    const parsed = codeSchema.safeParse(code)
    const normalized = parsed.success ? normalizeReferralCode(parsed.data) : null
    if (!normalized) return { success: true, data: null }

    if (isBotUserAgent((await headers()).get("user-agent"))) return { success: true, data: null }

    const day = partnerDay(new Date())
    const jar = await cookies()
    const prev = jar.get(PARTNER_SEEN_COOKIE)?.value
    if (seenCodes(prev, day).includes(normalized)) return { success: true, data: null }

    await connectDB()
    const owner = await referralOwner(normalized)
    if (!owner) return { success: true, data: null }

    // The partner's own visit (only detectable while signed in, ruling 4).
    const user = await getCurrentUser()
    if (user?.id === owner.id) return { success: true, data: null }

    const count = () => PartnerClick.updateOne({ code: normalized, day }, { $inc: { count: 1 } }, { upsert: true })
    try {
      await count()
    } catch (err) {
      // A racing first insert of the same code and day: the row exists now.
      if ((err as { code?: number }).code !== 11000) throw err
      await count()
    }

    jar.set(PARTNER_SEEN_COOKIE, withSeenCode(prev, day, normalized), {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: !isLocalDev,
      maxAge: 60 * 60 * 48,
    })
    return { success: true, data: null }
  } catch (err) {
    console.error("[Partners] visit not recorded:", err)
    return { success: false, error: "Visit not recorded" }
  }
}
