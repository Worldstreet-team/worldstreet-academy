"use client"

import * as React from "react"
import { Topbar } from "@/components/platform/topbar"
import { CourseCard, CourseCardSkeleton } from "@/components/platform/course-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCourses } from "@/components/shared/illustrations"
import { useEnrollments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"
import { SearchIcon } from "lucide-react"

const TABS = ["All", "In Progress", "Completed"] as const
type Tab = (typeof TABS)[number]

export default function MyCoursesPage() {
  const [activeTab, setActiveTab] = React.useState<Tab>("All")
  const [search, setSearch] = React.useState("")
  const { data: enrolledCourses = [], isLoading } = useEnrollments()

  const filteredCourses = React.useMemo(() => {
    let courses = enrolledCourses

    switch (activeTab) {
      case "In Progress":
        courses = courses.filter((c) => c.progress > 0 && c.progress < 100)
        break
      case "Completed":
        courses = courses.filter((c) => c.progress === 100)
        break
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      courses = courses.filter(
        (c) =>
          c.courseTitle.toLowerCase().includes(q) ||
          c.instructorName.toLowerCase().includes(q)
      )
    }

    return courses
  }, [activeTab, search, enrolledCourses])

  return (
    <>
      <Topbar title="My Courses" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
              My courses
            </h1>
            <p className="mt-1 text-[15px] text-ws-muted">
              Everything you&apos;re enrolled in, in one place.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : enrolledCourses.length === 0 ? (
            <EmptyState
              art={<ArtCourses />}
              title="You're not enrolled in anything yet"
              description="Pick a course and it'll show up here with your progress."
              actionLabel="Browse courses"
              actionHref="/dashboard/courses"
            />
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* SegmentedControl per 04-components: height 40, pill
                    container on bg/track, padding 3, active segment raised */}
                <div className="flex h-10 w-fit items-center rounded-full bg-ws-track p-[3px]">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex h-[34px] items-center whitespace-nowrap rounded-full px-4 text-[13px] transition-colors duration-[var(--ws-motion-fast)]",
                        activeTab === tab
                          ? "bg-ws-raised font-semibold text-ws-primary"
                          : "font-medium text-ws-muted hover:text-ws-primary"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="relative sm:w-72">
                  <SearchIcon
                    
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ws-subtle" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your courses…"
                    className="h-10 w-full rounded-full bg-ws-chip pl-11 pr-4 text-sm text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] placeholder:text-ws-subtle focus:ring-[1.5px] focus:ring-ws-brand"
                  />
                </div>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[13px] text-ws-muted">
                  <p>
                    {search.trim()
                      ? `No courses match "${search}"`
                      : `No ${activeTab.toLowerCase()} courses`}
                  </p>
                  <button
                    type="button"
                    onClick={() => (search.trim() ? setSearch("") : setActiveTab("All"))}
                    className="mt-1 text-[13px] font-medium text-ws-gold hover:opacity-80"
                  >
                    {search.trim() ? "Clear search" : "Show all courses"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      href={`/dashboard/courses/${course.courseId}/learn/${course.resumeLessonId ?? course.firstLessonId ?? "first"}`}
                      title={course.courseTitle}
                      thumbnailUrl={course.courseThumbnail}
                      instructorName={course.instructorName}
                      instructorAvatarUrl={course.instructorAvatarUrl}
                      progress={course.progress}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
