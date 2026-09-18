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
 * What a program shows: its own thumbnail, else its school's cover, else
 * null (the caller renders the school icon). The cover is the school's real
 * art, never a stand-in for data.
 */
export function programArt(course: { thumbnailUrl?: string | null; school?: string | null }): string | null {
  return course.thumbnailUrl || schoolCover(course.school)
}
