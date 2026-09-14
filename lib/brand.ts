/**
 * Brand facts for WorldStreet Mastery Academy. The only place the product
 * name, lockup eyebrow, tagline and sender identity are spelled out — every
 * surface imports from here (design-system 04-components → TopNav lockup).
 */
export const BRAND = {
  name: "WorldStreet Mastery Academy",
  /** Lockup wordmark next to the gold wsa-mark. */
  wordmark: "WorldStreet",
  /** Lockup eyebrow; rendered uppercase by CSS. Admin shell overrides with "Admin". */
  eyebrow: "Mastery Academy",
  tagline: "Learn Skills. Build Value. Own Your Future.",
  descriptor:
    "The world's premier institution for skills, innovation and wealth liquefaction.",
  supportEmail: "support@worldstreetgold.com",
  fromEmail: "WorldStreet Mastery Academy <noreply@worldstreet.academy>",
  certificatePrefix: "WSA",
} as const
