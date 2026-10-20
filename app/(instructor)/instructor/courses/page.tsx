"use client"
import { ArrowRight, ClipboardCheck, Link2, Plus, Search, Users } from "@/components/icons"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCourses, ArtSearch } from "@/components/shared/illustrations"
import { InstructorCourseCard } from "@/components/instructor/instructor-course-card"
import { CourseCardSkeleton } from "@/components/platform/course-card"
import { ProgramCover } from "@/components/platform/program-bits"
import { CardShell } from "@/components/ui/system"
import { useInstructorCourses } from "@/lib/hooks/queries"
import { useUser } from "@/components/providers/user-provider"
import { fetchTaughtPrograms, type TaughtProgramItem } from "@/lib/actions/instructor"


type StatusFilter = "all" | "published" | "draft" | "archived"

const TAUGHT_LINK =
  "inline-flex min-h-11 items-center gap-1.5 font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"

/** A program you're assigned to teach: teaching links only — no editor, price or earnings. */
function TaughtProgramCard({ program }: { program: TaughtProgramItem }) {
  return (
    <CardShell>
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <ProgramCover src={program.thumbnailUrl} sizes="44px" mark="sm" className="h-11 w-11 shrink-0 rounded-[9px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ws-primary">{program.title}</span>
          <span className="truncate text-[12px] text-ws-muted">
            {[program.schoolName, `${program.enrolledCount.toLocaleString()} students`, program.status !== "published" ? `${program.status[0].toUpperCase()}${program.status.slice(1)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 border-t border-ws-hairline px-4 text-[13px]">
        <Link href={`/instructor/courses/${program.id}/assignments`} className={TAUGHT_LINK}>
          <ClipboardCheck size={14} strokeWidth={2} aria-hidden />
          Assignments
        </Link>
        <Link href={`/instructor/students?program=${program.id}`} className={TAUGHT_LINK}>
          <Users size={14} strokeWidth={2} aria-hidden />
          Students
          <ArrowRight size={13} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </CardShell>
  )
}

export default function InstructorCoursesPage() {
  const [courseSearch, setCourseSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const { data: courses = [], isLoading } = useInstructorCourses()
  // Only approved marketplace sellers reach the instructor area without a faculty role.
  const seller = useUser().role === "USER"
  // Programs an admin assigned you to teach (owned by the Academy or another instructor).
  const { data: taught = [] } = useQuery({
    queryKey: ["instructor", "taught-programs"],
    queryFn: () => fetchTaughtPrograms(),
    enabled: !seller,
  })
  // The split, once for the page — every live marketplace course of a seller carries its own link.
  const shareNote = courses.find((c) => c.share)?.share?.note ?? null

  const totalStudents = courses.reduce((s, c) => s + c.enrolledCount, 0)
  const publishedCount = courses.filter((c) => c.status === "published").length
  const draftCount = courses.filter((c) => c.status === "draft").length
  const archivedCount = courses.filter((c) => c.status === "archived").length

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: courses.length },
    { key: "published", label: "Published", count: publishedCount },
    { key: "draft", label: "Draft", count: draftCount },
    ...(archivedCount > 0
      ? [{ key: "archived" as const, label: "Archived", count: archivedCount }]
      : []),
  ]

  // Plain derivation — the React Compiler memoizes this automatically.
  const q = courseSearch.toLowerCase()
  const filteredCourses = courses.filter(
    (c) =>
      (statusFilter === "all" || c.status === statusFilter) &&
      (!courseSearch.trim() || c.title.toLowerCase().includes(q))
  )

  return (
    <>
      <Topbar title="My Courses" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="My Courses"
            subline={`${courses.length} total · ${publishedCount} published · ${draftCount} drafts · ${archivedCount} archived · ${totalStudents.toLocaleString()} students`}
            action={
              <Button
                render={<Link href="/instructor/courses/new" />}
                className="hidden bg-ws-brand text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:bg-ws-brand hover:opacity-90 md:inline-flex"
              >
                <Plus size={16} strokeWidth={2} />
                New Course
              </Button>
            }
          />

          {shareNote && (
            <div className="flex items-start gap-3 rounded-lg border border-ws-hairline bg-ws-surface p-4">
              <Link2 size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-ws-muted" />
              <div className="space-y-0.5 text-[13px]">
                <p className="font-semibold text-ws-primary">Share your own link</p>
                <p className="text-ws-muted">
                  Each live course below has a link with your code — copy it and send it to your audience. {shareNote}
                </p>
              </div>
            </div>
          )}

          {/* Search + status filter chips */}
          <div className="space-y-3">
            <div className="relative">
              <Search
                size={16}
                strokeWidth={2}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ws-muted"
              />
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Search your courses..."
                className="h-11 md:h-10 w-full rounded-md border border-ws-hairline bg-ws-surface pl-9 pr-3 text-base md:text-sm text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] placeholder:text-ws-muted focus:border-ws-muted/40"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((f) => {
                const active = statusFilter === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStatusFilter(f.key)}
                    aria-pressed={active}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors duration-[var(--ws-motion-fast)] ${
                      active
                        ? "bg-ws-chip font-semibold text-ws-primary"
                        : "text-ws-muted hover:bg-ws-chip/60 hover:text-ws-primary"
                    }`}
                  >
                    {f.label}
                    <span className="tabular-nums text-[11px] text-ws-subtle">{f.count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              art={<ArtCourses />}
              title="No courses yet"
              description={
                seller
                  ? "Create your first marketplace course, add your lessons and submit it for review."
                  : "Create your first course to start teaching on the Academy."
              }
              actionLabel="Create Your First Course"
              actionHref="/instructor/courses/new"
            />
          ) : filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <ArtSearch className="mb-4 w-40" />
              <p className="text-sm text-ws-muted">
                {courseSearch.trim()
                  ? `No courses match "${courseSearch}"`
                  : `No ${statusFilter} courses`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCourseSearch("")
                  setStatusFilter("all")
                }}
                className="mt-2 text-xs font-medium text-ws-gold transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-80"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((course) => (
                <InstructorCourseCard key={course.id} course={course} />
              ))}
            </div>
          )}

          {taught.length > 0 && (
            <section aria-labelledby="taught-heading" className="space-y-3">
              <div className="space-y-0.5">
                <h2 id="taught-heading" className="text-[15px] font-semibold text-ws-primary">
                  Programs you teach
                </h2>
                <p className="text-[13px] text-ws-muted">
                  You run these programs&apos; classes, mentorship and grading. Their owner manages the program itself.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {taught.map((program) => (
                  <TaughtProgramCard key={program.id} program={program} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
