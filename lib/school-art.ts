import { schoolSlugOf, type SchoolSlug } from "@/lib/schools"

/**
 * Cover art for the seven schools: static, code-owned files under
 * `public/art/schools/`. A slug missing here has no cover yet and every
 * surface falls back to the school's icon, so art lands one file at a time.
 * Add an entry only in the same commit as its file.
 */
export const SCHOOL_COVERS: Partial<Record<SchoolSlug, string>> = {
  "trading-financial-markets": "/art/schools/trading-financial-markets.webp",
  "technology-ai": "/art/schools/ai-automation.webp",
  "digital-business": "/art/schools/digital-business-remote-careers.webp",
  "entrepreneurship-wealth-creation": "/art/schools/entrepreneurship-wealth-creation.webp",
  "creative-economy": "/art/schools/digital-media-creative.webp",
  "leadership-personal-development": "/art/schools/leadership-personal-development.webp",
  "emerging-technologies": "/art/schools/blockchain-web3.webp",
}

/** The cover for a current or retired school slug. */
export function schoolCover(slug: string | null | undefined): string | null {
  const current = schoolSlugOf(slug)
  return current ? (SCHOOL_COVERS[current] ?? null) : null
}

/**
 * Art for the programs: static, code-owned files under
 * `public/art/programs/`, keyed by `Course.slug`. A slug missing here has no
 * program art yet and falls back to the school's cover, then the school
 * icon — art can land one file at a time. Add an entry only in the same
 * commit as its file.
 */
export const PROGRAM_ART: Partial<Record<string, string>> = {
  "forex-trading-mastery": "/art/programs/forex-trading-mastery.webp",
  "crypto-trading-mastery": "/art/programs/crypto-trading-mastery.webp",
  "blockchain-technology-mastery": "/art/programs/blockchain-technology-mastery.webp",
  "ai-ai-automation": "/art/programs/ai-ai-automation.webp",
  "app-development-with-ai": "/art/programs/app-development-with-ai.webp",
  cybersecurity: "/art/programs/cybersecurity.webp",
  "data-analysis": "/art/programs/data-analysis.webp",
  "content-creation-mastery": "/art/programs/content-creation-mastery.webp",
  "video-editing-mastery": "/art/programs/video-editing-mastery.webp",
  "tech-sales-digital-marketing": "/art/programs/tech-sales-digital-marketing.webp",
  "e-commerce-digital-business": "/art/programs/e-commerce-digital-business.webp",
  "virtual-assistance": "/art/programs/virtual-assistance.webp",
}

/**
 * Live programs were renamed after their art was drawn (2026-11-12, checked
 * against the production sitemap): the base slug on the left, its art's key on the right.
 */
const PROGRAM_ART_ALIASES: Partial<Record<string, string>> = {
  "artificial-intelligence-ai-automation": "ai-ai-automation",
  "content-creation-video-editing-mastery": "content-creation-mastery",
}

/**
 * A program's own art by slug. Production slugs carry a random six-character
 * suffix (`forex-trading-mastery-j7g0ta`), so the plain key never matched
 * there and 10 of the 12 live programs showed old stock photos instead.
 */
function programArtFor(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined
  if (PROGRAM_ART[slug]) return PROGRAM_ART[slug]
  const base = slug.replace(/-[a-z0-9]{6}$/, "")
  return PROGRAM_ART[base] ?? PROGRAM_ART[PROGRAM_ART_ALIASES[base] ?? ""]
}

/**
 * A stock photo the old catalogue seeded as a thumbnail (images.unsplash.com),
 * not one anyone uploaded: the uploads go to R2 or Cloudinary.
 */
function isStockThumbnail(url: string): boolean {
  return /^https:\/\/images\.unsplash\.com\//.test(url)
}

/**
 * What a program shows: its own uploaded thumbnail, else its own program art
 * (`PROGRAM_ART`), else a seeded stock photo, else its school's cover, else
 * null (the caller renders the school icon). An uploaded thumbnail always
 * wins; since 2026-11-12 the designed art beats a stock photo, and a live slug's
 * random suffix no longer hides its art. Was:
 * return course.thumbnailUrl || (course.slug ? PROGRAM_ART[course.slug] : undefined) || schoolCover(course.school) || null
 */
export function programArt(course: {
  thumbnailUrl?: string | null
  school?: string | null
  slug?: string | null
}): string | null {
  const own = course.thumbnailUrl || null
  if (own && !isStockThumbnail(own)) return own
  return programArtFor(course.slug) || own || schoolCover(course.school) || null
}
