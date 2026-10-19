/**
 * Brand facts for WorldStreet Mastery Academy. The only place the product
 * name, lockup eyebrow, tagline and sender identity are spelled out — every
 * surface imports from here (design-system 04-components → TopNav lockup).
 */

/** The Academy's authorized signatory on certificates (decision D9). */
export type Signatory = { name: string | null; title: string | null; imagePath: string | null }

/**
 * Product has not supplied the signatory's name or signature file yet (product
 * debt). Certificates render the Academy signatory block only when `name` and
 * `imagePath` are both set — until then the instructor signature is the
 * authorized signature. Never fill these with a placeholder person.
 * `imagePath` is a public path, e.g. "/brand/signatory.png".
 */
const SIGNATORY: Signatory = { name: null, title: null, imagePath: null }

export const BRAND = {
  name: "WorldStreet Mastery Academy",
  /** Lockup wordmark next to the gold wsa-mark. */
  wordmark: "WorldStreet",
  /** Lockup eyebrow; rendered uppercase by CSS. Admin shell overrides with "Admin". */
  eyebrow: "Mastery Academy",
  shortName: "WMA",
  tagline: "The Academy of the New Economy",
  descriptor:
    "The world's premier institution for skills, innovation and wealth liquefaction.",
  supportEmail: "support@worldstreetgold.com",
  fromEmail: "WorldStreet Mastery Academy <noreply@worldstreet.academy>",
  certificatePrefix: "WSA",
  signatory: SIGNATORY,
} as const

/**
 * Default meta description — the root layout's (every page without its own)
 * and the homepage's. Institutional blueprint §22; the name comes from BRAND (D1).
 */
export const SITE_DESCRIPTION = `${BRAND.name} is a global institution for the new economy that equips people with practical knowledge, develops that knowledge into mastery, and helps them apply valuable skills to create economic value and transform their financial capacity.`
