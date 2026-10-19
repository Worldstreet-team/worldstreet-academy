import type { PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL } from "@/lib/entitlements"

/**
 * The one home of the certificate tier rules (institutional blueprint §13,
 * D25). Pure and client-safe. The thresholds are named constants the owner may
 * tune. A stored tier is never lowered (`lib/certificate-standing.ts`).
 */

export type CertificateTier = "completion" | "practitioner" | "mastery"
/** Ladder order. */
export const CERT_TIERS: readonly CertificateTier[] = ["completion", "practitioner", "mastery"]

/** §13, verbatim. */
export const CERT_TIER_LABEL: Record<CertificateTier, string> = {
  completion: "WMA Certificate of Completion",
  practitioner: "WMA Certified Practitioner",
  mastery: "WMA Mastery Certification",
}
/** The paper's two lines: large, then small. */
export const CERT_TIER_TITLE: Record<CertificateTier, readonly [string, string]> = {
  completion: ["Certificate", "of Completion"],
  practitioner: ["Certified", "Practitioner"],
  mastery: ["Mastery", "Certification"],
}
/** §19 / D19: a learner holding a certificate. */
export const ALUMNI_LABEL = "WMA Alumni"

/** D25 thresholds — inclusive. */
export const PRACTITIONER_PLANS: readonly PackageKey[] = ["standard", "executive"]
export const PRACTITIONER_MIN_SCORE = 70
export const MASTERY_MIN_SCORE = 85
export const MASTERY_MIN_PROJECT_GRADE = 70

export type TierInput = {
  /** Enrollment.status === "completed" (ruling 2). */
  completed: boolean
  /** The plan includes the certificate: entitlementsFor(course, enrollment).certificate. */
  certifies: boolean
  packageKey: PackageKey | null
  examPassed: boolean
  /** The program has a published final exam — read by nextTierNeeds' copy only. */
  hasFinalExam: boolean
  /** Phase 16's Mastery Score, 0–100; null until two parts have data. */
  score: number | null
  /** Best graded project-kind submission, 0–100; null when none is graded. */
  bestProjectGrade: number | null
}
export type NextTier = { tier: CertificateTier; needs: string[] }

const PLAN_NAMES = PRACTITIONER_PLANS.map((k) => PACKAGE_LABEL[k]).join(" or ")

/** The highest tier the facts earn, or null while the enrollment isn't completed and certifying. */
export function tierFor(input: TierInput): CertificateTier | null {
  if (!input.completed || !input.certifies) return null
  const practitioner =
    input.packageKey !== null &&
    PRACTITIONER_PLANS.includes(input.packageKey) &&
    input.examPassed &&
    input.score !== null &&
    input.score >= PRACTITIONER_MIN_SCORE
  if (!practitioner) return "completion"
  const mastery =
    input.score !== null &&
    input.score >= MASTERY_MIN_SCORE &&
    input.bestProjectGrade !== null &&
    input.bestProjectGrade >= MASTERY_MIN_PROJECT_GRADE
  return mastery ? "mastery" : "practitioner"
}

/** The later of two tiers on the ladder; null only when both are null. */
export function higherTier(a: CertificateTier | null, b: CertificateTier | null): CertificateTier | null {
  const rank = (t: CertificateTier | null): number => (t === null ? -1 : CERT_TIERS.indexOf(t))
  return rank(b) > rank(a) ? b : a
}

/** null, then every tier earlier on the ladder than `tier`. */
export function tiersBelow(tier: CertificateTier): (CertificateTier | null)[] {
  return [null, ...CERT_TIERS.slice(0, CERT_TIERS.indexOf(tier))]
}

/** What stands between the learner and the rung after `current` (their stored tier). */
export function nextTierNeeds(input: TierInput, current: CertificateTier): NextTier | null {
  if (tierFor(input) === null || current === "mastery") return null
  const tier = CERT_TIERS[CERT_TIERS.indexOf(current) + 1]
  const needs: string[] = []
  if (input.packageKey === null || !PRACTITIONER_PLANS.includes(input.packageKey)) {
    needs.push(`Study on the ${PLAN_NAMES} plan`)
  } else {
    if (!input.examPassed) {
      needs.push(input.hasFinalExam ? "Pass the final exam" : "Pass the final exam (this program has none published yet)")
    }
    const min = tier === "mastery" ? MASTERY_MIN_SCORE : PRACTITIONER_MIN_SCORE
    if (input.score === null || input.score < min) {
      needs.push(`Reach a Mastery Score of ${min} (${input.score === null ? "not enough data yet" : `yours: ${input.score}`})`)
    }
    if (tier === "mastery" && (input.bestProjectGrade === null || input.bestProjectGrade < MASTERY_MIN_PROJECT_GRADE)) {
      needs.push(
        `Score ${MASTERY_MIN_PROJECT_GRADE} or more on a graded project (${
          input.bestProjectGrade === null ? "none graded yet" : `best so far: ${input.bestProjectGrade}`
        })`
      )
    }
  }
  return needs.length === 0 ? null : { tier, needs }
}

/** How a stored tier reads everywhere; null is Completion (Go R13 included). */
export function certificateTierLabel(tier: CertificateTier | null | undefined): string {
  return CERT_TIER_LABEL[tier ?? "completion"]
}

/** The published requirement lines — every number comes from the constants above. */
export const CERT_TIER_REQUIREMENTS: Record<CertificateTier, readonly string[]> = {
  completion: [
    "Complete every lesson your plan includes.",
    "Pass the final exam, where the program requires one.",
    "Open to every plan that includes a certificate.",
  ],
  practitioner: [
    `Earn the ${CERT_TIER_LABEL.completion}.`,
    "Pass the program's final exam.",
    `Reach a WMA Mastery Score of ${PRACTITIONER_MIN_SCORE} or more.`,
    `Study on the ${PLAN_NAMES} plan.`,
  ],
  mastery: [
    `Earn the ${CERT_TIER_LABEL.practitioner} credential.`,
    `Reach a WMA Mastery Score of ${MASTERY_MIN_SCORE} or more.`,
    `Score ${MASTERY_MIN_PROJECT_GRADE} or more on a graded project.`,
  ],
}
