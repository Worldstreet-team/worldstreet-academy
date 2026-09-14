import { randomBytes } from "crypto"
import { BRAND } from "@/lib/brand"
import { Course, Enrollment, type IEnrollment } from "@/lib/db/models"
import { entitlementsFor } from "@/lib/entitlements"

/**
 * Certificate IDs (spec §13). One home for the rules: how an ID is generated,
 * the legacy value certificates printed before IDs were stored, how user input
 * is normalized, and when an enrollment gets one.
 *
 * Server-only by construction (node crypto + Mongoose) — never import this from
 * a "use client" file. The legacy rule is repeated literally in
 * components/learn/certificate-view.tsx (client bundle) and
 * scripts/backfill-certificate-ids.mjs (can't import TS); keep all three equal.
 */

/** Crockford base32: 0-9 and A-Z without I, L, O, U (nothing to misread). */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/** Stored IDs are prefix + 8 symbols; legacy hex IDs are a subset of [0-9A-Z]. */
const ID_SHAPE = new RegExp(`^${BRAND.certificatePrefix}-[0-9A-Z]{8}$`)

/** A fresh random ID: 5 random bytes = 40 bits = exactly 8 five-bit symbols (no modulo bias). */
export function generateCertificateId(): string {
  let value = randomBytes(5).readUIntBE(0, 5)
  let symbols = ""
  for (let i = 0; i < 8; i++) {
    symbols = CROCKFORD[value % 32] + symbols
    value = Math.floor(value / 32)
  }
  return `${BRAND.certificatePrefix}-${symbols}`
}

/** What certificates printed before IDs were stored: prefix + last 8 chars of the enrollment id, uppercased. */
export function legacyCertificateId(enrollmentId: string): string {
  return `${BRAND.certificatePrefix}-${enrollmentId.slice(-8).toUpperCase()}`
}

/** Trim + uppercase user input; null when it can't be a certificate ID (so it never reaches the database). */
export function normalizeCertificateId(raw: string): string | null {
  const id = raw.trim().toUpperCase()
  return ID_SHAPE.test(id) ? id : null
}

function isDuplicateCertificateId(err: unknown): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> } | null
  return e?.code === 11000 && Boolean(e.keyPattern && "certificateId" in e.keyPattern)
}

/**
 * Drop-in for `enrollment.save()` on the completion paths (completeLesson,
 * gradeAttempt's exam pass, markCourseComplete). Saves, then — when the
 * enrollment is completed, has no ID yet, and its package includes the
 * certificate — stamps one:
 *   - a random ID when this save is the transition into "completed";
 *   - the legacy value when it was already completed without an ID (the
 *     certificate page has been printing that value, so storing it keeps the
 *     printed ID verifiable).
 * The stamp only matches a still-completed row with no ID, so concurrent
 * completions can't hand out two IDs. A duplicate retries once with a fresh
 * random ID; a completion never fails because of its certificate ID.
 */
export async function saveWithCertificateId(enrollment: IEnrollment): Promise<void> {
  // Read before save() clears the modified state: an unchanged status means the
  // enrollment was already completed before this call.
  const firstCompletion = enrollment.isModified("status")
  await enrollment.save()

  if (enrollment.status !== "completed" || enrollment.certificateId) return

  const course = await Course.findById(enrollment.course).select("packages").lean()
  if (!course || !entitlementsFor(course, enrollment).certificate) return

  const enrollmentId = enrollment._id.toString()
  const candidates = [
    firstCompletion ? generateCertificateId() : legacyCertificateId(enrollmentId),
    generateCertificateId(),
  ]
  for (const certificateId of candidates) {
    try {
      await Enrollment.updateOne(
        { _id: enrollment._id, status: "completed", certificateId: null },
        { $set: { certificateId } }
      )
      return
    } catch (err) {
      if (!isDuplicateCertificateId(err)) throw err
    }
  }
  console.error(`[Certificates] no unique certificate ID for enrollment ${enrollmentId} after one retry`)
}
