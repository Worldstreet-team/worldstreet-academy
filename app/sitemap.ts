import type { MetadataRoute } from "next"
import { appUrl } from "@/lib/app-url"
import { SCHOOLS } from "@/lib/schools"
import { FACULTY_PUBLIC, facultyHref } from "@/lib/faculty"
import { fetchBrowseCourses, fetchFaculty } from "@/lib/actions/student"

// Programs and faculty change with publishing and roles — read them per
// request, never freeze them into the build (same rule as the marketing pages).
export const revalidate = 0

/**
 * /sitemap.xml — the indexable public pages: home, the schools, every
 * published program (the set /programs lists), the marketplace and New
 * Economy with their published courses (whose pages are /programs/<slug>
 * too), /calendar, /sell, /teach and, while faculty exists and is public (FACULTY_PUBLIC),
 * /faculty and each profile. Never /verify
 * (student names, noindex), the signed-in apps, /login, /register or the /courses redirects. No
 * lastModified: BrowseCourse carries no update time, and a guess would be false.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programs, marketplace, newEconomy, faculty] = await Promise.all([
    fetchBrowseCourses(),
    fetchBrowseCourses({ kind: "marketplace" }),
    fetchBrowseCourses({ kind: "new-economy" }),
    FACULTY_PUBLIC ? fetchFaculty() : Promise.resolve([]),
  ])

  return [
    { url: appUrl("/") },
    { url: appUrl("/academy") },
    { url: appUrl("/schools") },
    ...SCHOOLS.map((school) => ({ url: appUrl(`/schools/${school.slug}`) })),
    { url: appUrl("/programs") },
    ...programs.map((program) => ({ url: appUrl(`/programs/${program.slug}`) })),
    { url: appUrl("/marketplace") },
    ...marketplace.map((course) => ({ url: appUrl(`/programs/${course.slug}`) })),
    { url: appUrl("/new-economy") },
    ...newEconomy.map((course) => ({ url: appUrl(`/programs/${course.slug}`) })),
    { url: appUrl("/calendar") },
    { url: appUrl("/sell") },
    { url: appUrl("/teach") },
    ...(faculty.length > 0
      ? [{ url: appUrl("/faculty") }, ...faculty.map((member) => ({ url: appUrl(facultyHref(member.username)) }))]
      : []),
  ]
}
