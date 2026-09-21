import type { Metadata } from "next"
import { fetchBrowseCourses, fetchFacultyCount, fetchFreePreviewLessons } from "@/lib/actions/student"
import { getCachedUser } from "@/lib/auth/cached"
import { getStartGateState } from "@/lib/start-gate-state"
import { needsSchoolChoice } from "@/lib/start-gate"
import { appUrl } from "@/lib/app-url"
import { SchoolsIndex } from "@/components/schools-index/schools-index"
import { GateNotice } from "@/components/schools-index/gate-notice"
import { FreeLessons } from "@/components/schools-index/free-lessons"
import { BrowseAll } from "@/components/schools-index/browse-all"
import { LEVEL_ORDER, buildSchoolsIndex, type LevelFilter } from "@/components/schools-index/model"

export const metadata: Metadata = {
  title: "Schools",
  description:
    "Your future can take many directions. Choose the school that matches your interests, goals and ambitions.",
  alternates: { canonical: appUrl("/schools") },
}

// Programs, prices and free lessons come from the live catalogue.
export const revalidate = 0

type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * The gate's welcome, for a signed-in learner the school-first gate would
 * still send here (`?start=1` alone is not enough: an enrolled learner can
 * follow an old `/dashboard/start` link too). Fails closed to no notice.
 */
async function gateWelcome(): Promise<{ firstName: string } | null> {
  const user = await getCachedUser()
  if (!user || user.role !== "USER") return null
  const gate = await getStartGateState(user.id).catch(() => null)
  if (!gate) return null
  const sent = needsSchoolChoice({
    role: user.role,
    instructorStatus: user.instructorStatus,
    pathname: "/dashboard",
    ...gate,
  })
  return sent ? { firstName: (user.firstName ?? "").trim() } : null
}

/**
 * `/schools` — "Explore our schools" (blueprint §4, §17): the step between
 * the homepage and a school. A header with the eight covers and the real
 * totals, a search that narrows schools and their programs as you type, each
 * school as an editorial row listing its actual programs, then free lessons
 * and the full program list for anyone not ready to pick a school.
 *
 * Every figure is read from the published catalogue; anything that would be
 * zero is left out rather than shown.
 */
export default async function SchoolsPage({ searchParams }: Search) {
  const params = await searchParams
  const start = first(params.start) === "1"
  const q = (first(params.q) ?? "").slice(0, 80)
  const levelParam = first(params.level)
  const level: LevelFilter = LEVEL_ORDER.find((l) => l === levelParam) ?? "all"

  const [courses, previews, facultyCount, welcome] = await Promise.all([
    fetchBrowseCourses(),
    fetchFreePreviewLessons(9),
    fetchFacultyCount(),
    start ? gateWelcome().catch(() => null) : Promise.resolve(null),
  ])

  const data = buildSchoolsIndex(courses)
  const inSchools = data.schools.flatMap((s) => s.programs)
  const priced = inSchools.map((p) => p.price).filter((p): p is number => p !== null)
  const art = Array.from(
    new Set([...inSchools, ...data.others].map((p) => p.art).filter((a): a is string => Boolean(a)))
  )

  return (
    <div className="pb-24 md:pb-32">
      <SchoolsIndex
        data={data}
        stats={{
          schools: data.schools.length,
          programs: inSchools.length,
          from: priced.length ? Math.min(...priced) : null,
          instructors: facultyCount,
          freeLessons: previews.length,
        }}
        initialQuery={q}
        initialLevel={data.levels.length > 1 ? level : "all"}
        notice={welcome ? <GateNotice firstName={welcome.firstName} /> : null}
      />

      <div className="mx-auto mt-28 max-w-7xl space-y-24 px-6 md:mt-40 md:space-y-32">
        <FreeLessons lessons={previews} />
        <BrowseAll total={data.total} art={art} showFaculty={facultyCount > 0} />
      </div>
    </div>
  )
}
