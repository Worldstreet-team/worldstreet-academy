import type { StudentEnrollment } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import { grantsAccess } from "@/lib/dashboard-home"
import { safeWebUrl } from "@/lib/faculty"
import { SCHOOLS, type School } from "@/lib/schools"

/*
 * Communities (institutional blueprint §14, D26): external group links only,
 * no in-app forum. One deduplicated list per learner: their programs' groups,
 * their schools', the Academy's and, on an Executive plan, the Executive group.
 * Nothing shows until the learner holds an access-granting enrollment, and
 * every URL passes safeWebUrl. Client-safe: no server imports.
 */

export type CommunityScope = "program" | "school" | "academy" | "executive"
export type CommunityLink = { scope: CommunityScope; label: string; url: string }
export type CommunityProgram = Pick<
  StudentEnrollment,
  "status" | "courseTitle" | "communityUrl" | "school" | "packageKey" | "explicitPackage"
>

export const COMMUNITY_SCOPE_TITLE: Record<CommunityScope, string> = {
  program: "Program community",
  school: "School community",
  academy: "Academy community",
  executive: "Executive community",
}

/** Inlined at build time; blank → null. */
export const ACADEMY_COMMUNITY_URL: string | null = process.env.NEXT_PUBLIC_COMMUNITY_URL?.trim() || null
export const EXECUTIVE_COMMUNITY_URL: string | null = process.env.NEXT_PUBLIC_EXECUTIVE_COMMUNITY_URL?.trim() || null

export function communitiesFor(input: {
  programs: readonly CommunityProgram[]
  schools: readonly Pick<School, "slug" | "name" | "communityUrl">[]
  academyUrl: string | null
  executiveUrl: string | null
}): CommunityLink[] {
  const active = input.programs.filter(grantsAccess)
  if (active.length === 0) return []

  const rows: CommunityLink[] = []
  for (const p of active) {
    const url = safeWebUrl(p.communityUrl)
    if (url) rows.push({ scope: "program", label: p.courseTitle, url })
  }

  const slugs = new Set<string>()
  for (const p of active) {
    if (!p.school || slugs.has(p.school)) continue
    slugs.add(p.school)
    const school = input.schools.find((s) => s.slug === p.school)
    const url = safeWebUrl(school?.communityUrl)
    if (school && url) rows.push({ scope: "school", label: school.name, url })
  }

  const academy = safeWebUrl(input.academyUrl)
  if (academy) rows.push({ scope: "academy", label: BRAND.name, url: academy })

  if (active.some((p) => p.explicitPackage && p.packageKey === "executive")) {
    const executive = safeWebUrl(input.executiveUrl)
    if (executive) rows.push({ scope: "executive", label: "Executive plan learners", url: executive })
  }

  const seen = new Set<string>()
  return rows.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)))
}

/** communitiesFor with SCHOOLS and the two env links. */
export function myCommunities(programs: readonly CommunityProgram[]): CommunityLink[] {
  return communitiesFor({
    programs,
    schools: SCHOOLS,
    academyUrl: ACADEMY_COMMUNITY_URL,
    executiveUrl: EXECUTIVE_COMMUNITY_URL,
  })
}
