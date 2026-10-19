import { COHORT_TIME_ZONE } from "@/lib/cohort"

/**
 * The WMA Faculty credential (institutional blueprint §16, decision D29).
 * Pure and client-safe: Web Crypto only, no node:crypto. An ID is issued once
 * when onboarding completes and never changes once stored.
 */

export const FACULTY_CREDENTIAL_PREFIX = "WMAF"
export const FACULTY_CREDENTIAL_NAME = "WMA Faculty"

/** Crockford base32: 0-9 and A-Z without I, L, O, U (nothing to misread). */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

const ID_SHAPE = new RegExp(`^${FACULTY_CREDENTIAL_PREFIX}-[0-9A-HJKMNP-TV-Z]{6}$`)

/** A fresh ID: 30 random bits = exactly six 5-bit symbols, so no modulo bias. */
export function generateFacultyCredentialId(): string {
  let value = crypto.getRandomValues(new Uint32Array(1))[0] >>> 2
  let symbols = ""
  for (let i = 0; i < 6; i++) {
    symbols = CROCKFORD[value & 31] + symbols
    value >>>= 5
  }
  return `${FACULTY_CREDENTIAL_PREFIX}-${symbols}`
}

export function isFacultyCredentialId(v: string): boolean {
  return ID_SHAPE.test(v)
}

/** "since October 2026" */
export function facultySinceLabel(issuedAt: Date | string): string {
  const month = new Date(issuedAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: COHORT_TIME_ZONE,
  })
  return `since ${month}`
}

/** "19 October 2026" */
export function credentialIssuedLabel(issuedAt: Date | string): string {
  return new Date(issuedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: COHORT_TIME_ZONE,
  })
}

export type KycState = "verified" | "unverified" | "not_required" | "unknown"

/** Every checklist item except "Create your first course". An unreachable wallet defers; it never skips KYC. */
export function credentialReady(i: {
  agreementAccepted: boolean
  profileComplete: boolean
  signatureSet: boolean
  handbookDone: boolean
  kyc: KycState
}): boolean {
  return (
    i.agreementAccepted &&
    i.profileComplete &&
    i.signatureSet &&
    i.handbookDone &&
    (i.kyc === "verified" || i.kyc === "not_required")
  )
}
