/**
 * Referral codes and links (owner, 2026-10-05) — the client-safe rules.
 * Every student and tutor has one code; a marketplace seller's own code on
 * their own course is what makes a sale "sold through the seller's link".
 *
 * A link is any Academy page with `?ref=<CODE>`. The middleware stores the
 * code in the `wsa_ref` cookie (first-party, 30 days) so it survives the trip
 * through sign-up on the WorldStreet hub; checkout and the first user sync read
 * it from there.
 */

export const REFERRAL_COOKIE = "wsa_ref"
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
export const REFERRAL_PARAM = "ref"

/**
 * A seller's own link to their own course (owner meeting 2026-10-03: "if they
 * use their link by themselves to market their courses, it will show that they
 * are the one that sold it"). `?ref=` on a program page also stores
 * `<slug>~<CODE>` here — last touch, unlike REFERRAL_COOKIE — so a buyer who
 * once followed someone else's link still credits the seller whose course link
 * they bought through.
 */
export const SELLER_LINK_COOKIE = "wsa_ref_course"

export function sellerLinkValue(slug: string, code: string): string {
  return `${slug}~${code}`
}

/** The code stored for `slug`, or null. */
export function sellerLinkCodeFor(value: string | null | undefined, slug: string): string | null {
  const [storedSlug, code] = (value ?? "").split("~")
  return storedSlug && storedSlug === slug ? normalizeReferralCode(code) : null
}

/** Codes are 4–24 of A–Z, 0–9 and dashes, stored uppercase. */
const CODE_SHAPE = /^[A-Z0-9][A-Z0-9-]{2,22}[A-Z0-9]$/

/** A typed or linked code in its stored form, or null when it can't be one. */
export function normalizeReferralCode(input: string | null | undefined): string | null {
  const code = (input ?? "").trim().toUpperCase()
  return CODE_SHAPE.test(code) ? code : null
}

/** `path` with the code attached — `path` is site-relative ("/programs/x"). */
export function referralPath(path: string, code: string): string {
  const [base, hash = ""] = path.split("#")
  const sep = base.includes("?") ? "&" : "?"
  return `${base}${sep}${REFERRAL_PARAM}=${encodeURIComponent(code)}${hash ? `#${hash}` : ""}`
}
