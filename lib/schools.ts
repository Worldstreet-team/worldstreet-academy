/**
 * The eight Schools of WorldStreet Mastery Academy (spec §4–5). Static and
 * code-owned: a school is a way of grouping programs, not a document.
 * Program membership is NOT listed here — it is `Course.school` on each
 * course, so the DB is the only source of which programs a school has.
 */
export type SchoolSlug =
  | "trading-financial-markets"
  | "blockchain-web3"
  | "ai-automation"
  | "software-app-development"
  | "cybersecurity"
  | "data-analytics"
  | "digital-media-creative"
  | "digital-business-remote-careers"

export type School = {
  slug: SchoolSlug
  /** Full name, e.g. "School of Trading & Financial Markets". */
  name: string
  /** Short label without "School of" — also written to Course.category for legacy/mobile displays. */
  short: string
  /** Card blurb (spec §4). */
  blurb: string
  /** School-page headline (spec §5); null renders nothing. */
  tagline: string | null
  /** School-page intro paragraph (spec §5); null falls back to blurb. */
  intro: string | null
  /** lucide icon name for RenderIcon. */
  icon: string
  order: number
}

export const SCHOOLS: readonly School[] = [
  {
    slug: "trading-financial-markets", order: 1, icon: "landmark",
    name: "School of Trading & Financial Markets",
    short: "Trading & Financial Markets",
    blurb: "Learn about Forex, cryptocurrency, market analysis, risk management and trading psychology.",
    tagline: "Understand the markets. Develop your skills. Trade with knowledge.",
    intro: "Financial markets offer enormous opportunities—but opportunity without knowledge can become expensive experience. Our programs are designed to help students understand market fundamentals, develop structured approaches to analysis and learn responsible risk management.",
  },
  {
    slug: "blockchain-web3", order: 2, icon: "blocks",
    name: "School of Blockchain & Web3",
    short: "Blockchain & Web3",
    blurb: "Understand the technology behind blockchain, digital assets and the emerging Web3 economy.",
    tagline: null, intro: null,
  },
  {
    slug: "ai-automation", order: 3, icon: "bot",
    name: "School of Artificial Intelligence & Automation",
    short: "AI & Automation",
    blurb: "Discover how AI is transforming business, productivity, creativity and everyday work.",
    tagline: null, intro: null,
  },
  {
    slug: "software-app-development", order: 4, icon: "code",
    name: "School of Software & App Development",
    short: "Software & App Development",
    blurb: "Learn how modern applications are designed and developed, including the use of AI-powered development tools.",
    tagline: null, intro: null,
  },
  {
    slug: "cybersecurity", order: 5, icon: "shield-check",
    name: "School of Cybersecurity",
    short: "Cybersecurity",
    blurb: "Build knowledge of digital security, cyber threats and responsible cybersecurity practices.",
    tagline: null, intro: null,
  },
  {
    slug: "data-analytics", order: 6, icon: "chart-column",
    name: "School of Data & Analytics",
    short: "Data & Analytics",
    blurb: "Learn how to collect, understand, analyze and communicate data for better decisions.",
    tagline: null, intro: null,
  },
  {
    slug: "digital-media-creative", order: 7, icon: "clapperboard",
    name: "School of Digital Media & Creative Technology",
    short: "Digital Media & Creative Technology",
    blurb: "Turn ideas into compelling digital content and develop skills for the creator economy.",
    tagline: null, intro: null,
  },
  {
    slug: "digital-business-remote-careers", order: 8, icon: "briefcase",
    name: "School of Digital Business & Remote Careers",
    short: "Digital Business & Remote Careers",
    blurb: "Build practical skills for selling, marketing, e-commerce and working in the global digital economy.",
    tagline: null, intro: null,
  },
]

export const SCHOOL_BY_SLUG = Object.fromEntries(SCHOOLS.map((s) => [s.slug, s])) as Record<SchoolSlug, School>

/** Tuple form for z.enum(). */
export const SCHOOL_SLUGS = SCHOOLS.map((s) => s.slug) as [SchoolSlug, ...SchoolSlug[]]

export function isSchoolSlug(value: unknown): value is SchoolSlug {
  return typeof value === "string" && SCHOOLS.some((s) => s.slug === value)
}

/**
 * Program count per school from any list carrying `school` (e.g. the
 * published `BrowseCourse[]` the landing already fetches). Every school is
 * present in the result, zero included, so cards never read `undefined`.
 */
export function countProgramsBySchool(
  items: ReadonlyArray<{ school: SchoolSlug | null }>
): Record<SchoolSlug, number> {
  const counts = Object.fromEntries(SCHOOLS.map((s) => [s.slug, 0])) as Record<SchoolSlug, number>
  for (const item of items) {
    if (item.school && item.school in counts) counts[item.school] += 1
  }
  return counts
}

/**
 * Cheapest program per school, whole USD (0 = a free program exists), null
 * when the school has no priced program. `price` is already the cheapest
 * enabled package (Phase 0 rule), so this never re-derives package rules.
 */
export function cheapestBySchool(
  items: ReadonlyArray<{ school: SchoolSlug | null; pricing: "free" | "paid"; price: number | null }>
): Record<SchoolSlug, number | null> {
  const out = Object.fromEntries(SCHOOLS.map((s) => [s.slug, null])) as Record<SchoolSlug, number | null>
  for (const item of items) {
    if (!item.school || !(item.school in out)) continue
    const price = item.pricing === "free" ? 0 : item.price
    if (price === null || price === undefined) continue
    const current = out[item.school]
    if (current === null || price < current) out[item.school] = price
  }
  return out
}
