"use client"

import { Suspense, useMemo, useState } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { CourseCard, CourseCardSkeleton } from "@/components/platform/course-card"
import { CardShell, EmptyState, PageHeader, Rise, Segmented, type SegmentedOption } from "@/components/ui/system"
import { useBookmarkedIds, useBrowseCourses, useMyEnrollmentIntent, useToggleBookmark } from "@/lib/hooks/queries"
import { programPriceLabel } from "@/lib/program-price"
import { schoolCover } from "@/lib/school-art"
import { SCHOOLS, isSchoolSlug, type SchoolSlug } from "@/lib/schools"
import { cn } from "@/lib/utils"

type Level = "All" | "Beginner" | "Intermediate" | "Advanced"
const LEVELS: readonly SegmentedOption<Level>[] = [
  { key: "All", label: "All levels" },
  { key: "Beginner", label: "Beginner" },
  { key: "Intermediate", label: "Intermediate" },
  { key: "Advanced", label: "Advanced" },
]

const CHIP =
  "flex h-10 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-4 text-[13px] font-medium transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"

/*
 * Browse programs — by school first (owner, 2026-09-16), then level, then a
 * search. It opens on the learner's own school: `?school=` when linked, else
 * the school they saved. The school chips are a filter, not tabs: raised when
 * pressed, never gold. Level is the page's one Segmented.
 */
function BrowseProgramsInner() {
  const paramSchool = useSearchParams().get("school")
  const { data: intent } = useMyEnrollmentIntent()
  const [search, setSearch] = useState("")
  const [level, setLevel] = useState<Level>("All")
  // null = the learner has not touched the filter yet, so the default applies.
  const [chosen, setChosen] = useState<SchoolSlug | "all" | null>(null)
  const school: SchoolSlug | "all" = chosen ?? (isSchoolSlug(paramSchool) ? paramSchool : (intent?.school ?? "all"))

  const filters = useMemo(() => ({ level, pricing: "All" }), [level])
  const { data: courses = [], isLoading } = useBrowseCourses(filters)
  const bookmarkedIds = useBookmarkedIds()
  const toggleBookmark = useToggleBookmark()

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return courses.filter(
      (c) =>
        (school === "all" || c.school === school) &&
        (!q || c.title.toLowerCase().includes(q) || c.instructorName.toLowerCase().includes(q))
    )
  }, [courses, school, search])

  const filtered = school !== "all" || level !== "All" || search.trim() !== ""

  // Current time is read once per render to decide a card's "Not live yet"
  // face; a stale value only self-corrects on the next render — the same
  // tolerance `EnrollmentCard` already takes for the same decision.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()

  return (
    <>
      <Topbar title="Programs" />
      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:px-8 md:pb-12 md:pt-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <Rise>
            <PageHeader title="Programs" subtitle="Expert-led programs across eight schools. Start with yours." />
          </Rise>

          <Rise delay={60} className="flex flex-col gap-4">
            <div
              role="group"
              aria-label="School"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              <button
                type="button"
                aria-pressed={school === "all"}
                onClick={() => setChosen("all")}
                className={cn(
                  CHIP,
                  "pl-4",
                  school === "all" ? "bg-accent text-foreground ring-1 ring-border" : "bg-card text-muted-foreground hover:bg-accent"
                )}
              >
                All schools
              </button>
              {SCHOOLS.map((s) => {
                const cover = schoolCover(s.slug)
                const on = school === s.slug
                return (
                  <button
                    key={s.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChosen(s.slug)}
                    className={cn(
                      CHIP,
                      !cover && "pl-4",
                      on ? "bg-accent text-foreground ring-1 ring-border" : "bg-card text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {cover && (
                      <Image src={cover} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
                    )}
                    {s.short}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="relative flex-1">
                <span className="sr-only">Search programs</span>
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="ws-icon-mono pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ws-subtle"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search programs"
                  className="h-11 w-full rounded-full border border-transparent bg-ws-chip pl-10 pr-4 text-base text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] placeholder:text-ws-subtle focus:border-ws-brand md:h-10 md:text-sm"
                />
              </label>
              <Segmented options={LEVELS} value={level} onChange={setLevel} size="sm" className="self-start md:self-auto" />
            </div>
          </Rise>

          <Rise delay={120}>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <CardShell>
                <EmptyState
                  illustration="noTransactions"
                  title={filtered ? "No programs match" : "No programs published yet"}
                  description={
                    filtered
                      ? "Try another school or level — every program is listed under All schools."
                      : "New programs appear here as instructors publish them."
                  }
                  ctas={
                    filtered
                      ? [{ label: "Clear filters", onClick: () => { setChosen("all"); setLevel("All"); setSearch("") } }]
                      : []
                  }
                />
              </CardShell>
            ) : (
              <>
                <p className="mb-3 text-[13px] tabular-nums text-muted-foreground" aria-live="polite">
                  {shown.length === 1 ? "1 program" : `${shown.length} programs`}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((course) => (
                    <CourseCard
                      key={course.id}
                      href={`/dashboard/courses/${course.id}`}
                      title={course.title}
                      thumbnailUrl={course.thumbnailUrl}
                      price={course.price}
                      pricing={course.pricing}
                      priceLabel={programPriceLabel(course)}
                      rating={course.rating}
                      level={course.level}
                      totalDuration={course.totalDuration}
                      enrolledCount={course.enrolledCount}
                      comingSoonAt={
                        course.availableAt && new Date(course.availableAt).getTime() > now
                          ? course.availableAt
                          : null
                      }
                      isBookmarked={bookmarkedIds.has(course.id)}
                      onToggleBookmark={() => toggleBookmark.mutate(course.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </Rise>
        </div>
      </div>
    </>
  )
}

export default function BrowseProgramsPage() {
  // useSearchParams needs a Suspense boundary in the app router (matches
  // admin/enrollments and the exam pages' pattern).
  return (
    <Suspense fallback={null}>
      <BrowseProgramsInner />
    </Suspense>
  )
}
