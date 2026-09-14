import type { MetadataRoute } from "next"
import { appUrl } from "@/lib/app-url"
import { SCHOOLS } from "@/lib/schools"
import { facultyHref } from "@/lib/faculty"
import { fetchBrowseCourses, fetchFaculty } from "@/lib/actions/student"

// Programs and faculty change with publishing and roles — read them per
// request, never freeze them into the build (same rule as the marketing pages).
export const revalidate = 0

/**
 * /sitemap.xml — the indexable public pages: home, the schools, every
 * published program (the set /programs lists) and, while faculty exists,
 * /faculty and each profile. Never /verify (student names, noindex), the
 * signed-in apps, /login, /register or the /courses redirects. No
 * lastModified: BrowseCourse carries no update time, and a guess would be false.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programs, faculty] = await Promise.all([fetchBrowseCourses(), fetchFaculty()])

  return [
    { url: appUrl("/") },
    { url: appUrl("/schools") },
    ...SCHOOLS.map((school) => ({ url: appUrl(`/schools/${school.slug}`) })),
    { url: appUrl("/programs") },
    ...programs.map((program) => ({ url: appUrl(`/programs/${program.slug}`) })),
    ...(faculty.length > 0
      ? [{ url: appUrl("/faculty") }, ...faculty.map((member) => ({ url: appUrl(facultyHref(member.username)) }))]
      : []),
  ]
}
