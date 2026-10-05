import "server-only"
import { randomBytes } from "crypto"
import { User } from "@/lib/db/models"

/**
 * Server half of referrals (owner, 2026-10-05): minting a person's code.
 * Client-safe rules (cookie, normalizing, links) are in lib/referral-link.ts.
 * Callers have already run connectDB().
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
