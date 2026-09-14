import { randomBytes } from "crypto"
import type { Types } from "mongoose"
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

/**
 * What certificates printed before IDs were stored: prefix + last 8 chars of the enrollment id, uppercased.
 * The same rule lives in `printedCertificateId` (components/learn/certificate-view.tsx) and
 * scripts/backfill-certificate-ids.mjs — change all three together.
 */
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

/** What the stamp reads — a hydrated enrollment or a lean row. */
type StampableEnrollment = {
  _id: Types.ObjectId
  course: Types.ObjectId
  status: IEnrollment["status"]
  packageKey?: IEnrollment["packageKey"]
  certificateId?: string | null
}

/**
 * Stamps a certificate ID on a completed enrollment whose package includes the
 * certificate and that has none yet; returns the stored ID (null when it has
 * none). Does nothing for any other row.
 *   - `firstCompletion` (this save was the transition into "completed"): a random ID.
 *   - otherwise — an admin upgrade or restore, a Go/mobile completion, the
 *     deploy → backfill window — the legacy value the certificate page has been
 *     printing, so that printed ID stays verifiable. Never pass `true` outside
 *     a real first completion.
 * The write only matches a still-completed row with no ID, so the first writer
 * wins. A duplicate retries once with a fresh random ID. Never throws: a
 * completion never fails over its certificate ID.
 */
export async function ensureCertificateId(
  enrollment: StampableEnrollment,
  firstCompletion: boolean
): Promise<string | null> {
  if (enrollment.status !== "completed" || enrollment.certificateId) return enrollment.certificateId ?? null

  const enrollmentId = enrollment._id.toString()
  try {
    const course = await Course.findById(enrollment.course).select("packages").lean()
    if (!course || !entitlementsFor(course, enrollment).certificate) return null

    const candidates = [
      firstCompletion ? generateCertificateId() : legacyCertificateId(enrollmentId),
      generateCertificateId(),
    ]
    for (const certificateId of candidates) {
      try {
        const result = await Enrollment.updateOne(
          { _id: enrollment._id, status: "completed", certificateId: null },
          { $set: { certificateId } }
        )
        if (result.modifiedCount === 1) return certificateId
        // Someone else stamped it first (or the row left "completed"): report what is stored.
        const stored = await Enrollment.findById(enrollment._id).select("certificateId").lean()
        return stored?.certificateId ?? null
      } catch (err) {
        if (!isDuplicateCertificateId(err)) throw err
      }
    }
    console.error(`[Certificates] no unique certificate ID for enrollment ${enrollmentId} after one retry`)
  } catch (err) {
    console.error(`[Certificates] failed to stamp a certificate ID for enrollment ${enrollmentId}`, err)
  }
  return null
}

/**
 * Drop-in for `enrollment.save()` on the completion paths (completeLesson,
 * gradeAttempt's exam pass, markCourseComplete). Saves — a failed save still
 * throws — then stamps the certificate ID via `ensureCertificateId`, random when
 * this save is the transition into "completed", which never throws.
 */
export async function saveWithCertificateId(enrollment: IEnrollment): Promise<void> {
  // Read before save() clears the modified state: an unchanged status means the
  // enrollment was already completed before this call.
  const firstCompletion = enrollment.isModified("status")
  await enrollment.save()
  await ensureCertificateId(enrollment, firstCompletion)
}
