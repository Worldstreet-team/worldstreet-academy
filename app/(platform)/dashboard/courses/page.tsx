import { redirect } from "next/navigation"
import { isSchoolSlug } from "@/lib/schools"

/**
 * The in-dashboard "Programs" catalogue is retired (owner, 2026-09-18): a
 * second catalogue beside "My programs" was where learners got lost. Programs
 * are browsed and bought on the public catalogue; old links, bookmarks and the
 * "Browse programs" buttons land there — a `?school=` filter on that school's
 * page. A program's own pages (`/dashboard/courses/<id>/…`) are unaffected.
 */
export default async function BrowseProgramsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ school?: string | string[] }>
}) {
  const { school } = await searchParams
  redirect(typeof school === "string" && isSchoolSlug(school) ? `/schools/${school}` : "/programs")
}
