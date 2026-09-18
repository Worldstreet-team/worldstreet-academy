import { isSchoolSlug, type SchoolSlug } from "@/lib/schools"

/**
 * Cover art for the eight schools: static, code-owned files under
 * `public/art/schools/`. A slug missing here has no cover yet and every
 * surface falls back to the school's icon, so art lands one file at a time.
 * Add an entry only in the same commit as its file.
 */
export const SCHOOL_COVERS: Partial<Record<SchoolSlug, string>> = {
  "trading-financial-markets": "/art/schools/trading-financial-markets.webp",
  "blockchain-web3": "/art/schools/blockchain-web3.webp",
  "ai-automation": "/art/schools/ai-automation.webp",
  "software-app-development": "/art/schools/software-app-development.webp",
  "cybersecurity": "/art/schools/cybersecurity.webp",
  "data-analytics": "/art/schools/data-analytics.webp",
  "digital-media-creative": "/art/schools/digital-media-creative.webp",
  "digital-business-remote-careers": "/art/schools/digital-business-remote-careers.webp",
}

export function schoolCover(slug: string | null | undefined): string | null {
  return isSchoolSlug(slug) ? (SCHOOL_COVERS[slug] ?? null) : null
}

/**
 * Art for the 12 programs: static, code-owned files under
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
 * What a program shows: its own thumbnail, else its own program art
 * (`PROGRAM_ART`), else its school's cover, else null (the caller renders
 * the school icon). A program's uploaded thumbnail always wins; its
 * school's cover is the last fallback before the icon.
 */
export function programArt(course: {
  thumbnailUrl?: string | null
  school?: string | null
  slug?: string | null
}): string | null {
  return course.thumbnailUrl || (course.slug ? PROGRAM_ART[course.slug] : undefined) || schoolCover(course.school) || null
}
