import { isSchoolSlug, type SchoolSlug } from "@/lib/schools"

/**
 * Cover art for the eight schools: static, code-owned files under
 * `public/art/schools/`. A slug missing here has no cover yet and every
 * surface falls back to the school's icon, so art lands one file at a time.
 * Add an entry only in the same commit as its file.
 */
export const SCHOOL_COVERS: Partial<Record<SchoolSlug, string>> = {}

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
