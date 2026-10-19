import "server-only"
import type { Types } from "mongoose"
import { Course, Enrollment, Exam } from "@/lib/db/models"
import { entitlementsFor } from "@/lib/entitlements"
import { masteryInputsFor } from "@/lib/mastery-inputs"
import { masteryView } from "@/lib/mastery-score"
import {
  higherTier,
  nextTierNeeds,
  tierFor,
  tiersBelow,
  type CertificateTier,
  type NextTier,
  type TierInput,
} from "@/lib/certificate-tier"

/**
 * The stored certificate tier (institutional blueprint §13, D25). The rules are
 * in lib/certificate-tier.ts; this is the server side that gathers the inputs
 * and stores a raise.
 *
 * Callers have run `connectDB()`. It runs on a completion or final-exam attempt
 * (saveWithCertificateId), after a grade (gradeSubmission), after an admin
 * restore or plan change, and lazily when a learner opens a certificate.
 *
 * Never lowered: the write only matches a completed row whose stored tier is
 * strictly below the new one, and `certificateTierAt` moves only on a raise. A
 * stored tier outlives a later status change (a refund, an admin downgrade);
 * every surface already hides a certificate whose enrollment isn't completed
 * and certifying. Never throws: a completion, an exam or a grade never fails
 * over its tier.
 */

export type CertificateStanding = { tier: CertificateTier; next: NextTier | null }

export async function ensureCertificateTier(
  enrollmentId: Types.ObjectId | string
): Promise<CertificateStanding | null> {
  try {
    const enrollment = await Enrollment.findById(enrollmentId).lean()
    if (!enrollment || enrollment.status !== "completed") return null
    // `format` beside `packages`: a template or guide never certifies, so it never gets a tier.
    const course = await Course.findById(enrollment.course).select("packages format").lean()
    if (!course || !entitlementsFor(course, enrollment).certificate) return null

    const [facts, finalExam] = await Promise.all([
      masteryInputsFor(enrollment, course),
      Exam.exists({ course: enrollment.course, scope: "final", status: "published" }),
    ])
    const input: TierInput = {
      completed: true,
      certifies: true,
      packageKey: enrollment.packageKey ?? null,
      examPassed: Boolean(enrollment.examPassed),
      hasFinalExam: Boolean(finalExam),
      score: masteryView(facts).result.score,
      bestProjectGrade: facts.bestProjectGrade,
    }
    const computed = tierFor(input)
    const stored = enrollment.certificateTier ?? null

    let current: CertificateTier | null = stored
    if (computed !== null && higherTier(stored, computed) !== stored) {
      const result = await Enrollment.updateOne(
        { _id: enrollment._id, status: "completed", certificateTier: { $in: tiersBelow(computed) } },
        { $set: { certificateTier: computed, certificateTierAt: new Date() } }
      )
      if (result.modifiedCount === 1) {
        current = computed
      } else {
        const again = await Enrollment.findById(enrollment._id).select("certificateTier").lean()
        current = again?.certificateTier ?? null
      }
    }
    if (current === null) return null
    return { tier: current, next: nextTierNeeds(input, current) }
  } catch (err) {
    console.error(`[Certificates] failed to set the certificate tier for enrollment ${enrollmentId}`, err)
    return null
  }
}
