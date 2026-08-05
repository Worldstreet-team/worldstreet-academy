"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCourses, ArtSearch } from "@/components/shared/illustrations"
import { InstructorCourseCard } from "@/components/instructor/instructor-course-card"
import { CourseCardSkeleton } from "@/components/platform/course-card"
import { useInstructorCourses } from "@/lib/hooks/queries"
import { useQuery } from "@tanstack/react-query"
import { getMyInstructorEarnings } from "@/lib/actions/earnings"
import {
  BookOpen,
  ChartLine,
  DollarSign,
  Plus,
  Search,
  Star,
  Users,
} from "lucide-react"
import { useUser } from "@/components/providers/user-provider"
import { OnboardingChecklist } from "@/components/instructor/onboarding-checklist"

const quickActions = [
  {
    title: "Create Course",
    caption: "Add a new course",
    href: "/instructor/courses/new",
    icon: Plus,
  },
  {
    title: "Manage Courses",
    caption: "Edit & publish",
    href: "/instructor/courses",
    icon: BookOpen,
  },
  {
    title: "Analytics",
    caption: "View performance",
    href: "/instructor/analytics",
    icon: ChartLine,
  },
]

export default function InstructorDashboard() {
  const user = useUser()
  const [courseSearch, setCourseSearch] = React.useState("")
  const { data: myCourses = [], isLoading } = useInstructorCourses()
  const { data: earnings } = useQuery({
    queryKey: ["instructor", "earnings"],
    queryFn: () => getMyInstructorEarnings(),
  })

  const totalStudents = myCourses.reduce((s, c) => s + c.enrolledCount, 0)
  const ratedCourses = myCourses.filter((c) => c.rating != null)
  const avgRating =
    ratedCourses.length > 0
      ? (ratedCourses.reduce((s, c) => s + (c.rating ?? 0), 0) / ratedCourses.length).toFixed(1)
      : "—"

  // Plain derivation — the React Compiler memoizes this automatically.
  const q = courseSearch.toLowerCase()
  const filtered = courseSearch.trim()
    ? myCourses.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.status.toLowerCase().includes(q)
      )
    : myCourses

  const sections = [
    { key: "draft", title: "Drafts", courses: filtered.filter((c) => c.status === "draft") },
    { key: "published", title: "Published", courses: filtered.filter((c) => c.status === "published") },
    { key: "archived", title: "Archived", courses: filtered.filter((c) => c.status === "archived") },
  ].filter((s) => s.courses.length > 0)

  return (
    <>
      <Topbar title="Instructor Dashboard" variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title={`Welcome back, ${user.firstName}`}
            subline="Here's an overview of your teaching activity."
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

          {/* Post-approval onboarding (hides itself when complete) */}
          <OnboardingChecklist />

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total Courses"
              value={myCourses.length}
              icon={<BookOpen size={18} strokeWidth={2} />}
            />
            <StatTile
              label="Total Students"
              value={totalStudents.toLocaleString()}
              icon={<Users size={18} strokeWidth={2} />}
            />
            {/* Money comes from the earnings ledger, never price × enrollments */}
            <StatTile
              label="Earnings (net)"
              value={
                earnings
                  ? `$${(earnings.lifetimeNetMinor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "—"
              }
              context={
                earnings
                  ? `$${(earnings.clearedMinor / 100).toFixed(2)} in wallet · $${(earnings.pendingMinor / 100).toFixed(2)} clearing`
                  : "lifetime"
              }
              icon={<DollarSign size={18} strokeWidth={2} />}
              tone="gold"
            />
            <StatTile
              label="Avg. Rating"
              value={avgRating}
              context={ratedCourses.length > 0 ? `${ratedCourses.length} rated course${ratedCourses.length === 1 ? "" : "s"}` : undefined}
              icon={<Star size={18} strokeWidth={2} />}
              tone="gold"
            />
          </div>

          {/* Course search */}
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

          {/* Course sections */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : sections.length === 0 && courseSearch.trim() ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <ArtSearch className="mb-4 w-40" />
              <p className="text-sm text-ws-muted">
                No courses match &quot;{courseSearch}&quot;
              </p>
              <button
                type="button"
                onClick={() => setCourseSearch("")}
                className="mt-2 text-xs font-medium text-ws-gold transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-80"
              >
                Clear search
              </button>
            </div>
          ) : sections.length === 0 ? (
            <EmptyState
              art={<ArtCourses />}
              title="No courses yet"
              description="Create your first course to start teaching."
              actionLabel="Create Course"
              actionHref="/instructor/courses/new"
            />
          ) : (
            sections.map((section) => (
              <section key={section.key} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-ws-primary">{section.title}</h2>
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ws-chip px-1.5 text-[10px] font-semibold tabular-nums text-ws-muted">
                      {section.courses.length}
                    </span>
                  </div>
                  <Link
                    href="/instructor/courses"
                    className="text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
                  >
                    View all
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.courses.map((course) => (
                    <InstructorCourseCard key={course.id} course={course} />
                  ))}
                </div>
              </section>
            ))
          )}

          {/* Quick Actions */}
          <div className="space-y-3 border-t border-ws-hairline pt-8">
            <h2 className="text-sm font-semibold text-ws-primary">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {quickActions.map((qa) => {
                const Icon = qa.icon
                return (
                  <Link
                    key={qa.title}
                    href={qa.href}
                    className="flex items-center gap-3 rounded-lg border border-ws-hairline bg-ws-surface p-4 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised text-ws-gold">
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-ws-primary">{qa.title}</span>
                      <span className="block text-[11px] text-ws-muted">{qa.caption}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
