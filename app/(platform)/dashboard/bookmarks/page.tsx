"use client"

import * as React from "react"
import { Topbar } from "@/components/platform/topbar"
import { CourseCard, CourseCardSkeleton } from "@/components/platform/course-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtBookmarks } from "@/components/shared/illustrations"
import { useBookmarks, useToggleBookmark } from "@/lib/hooks/queries"
import { SearchIcon } from "lucide-react"

export default function BookmarksPage() {
  const [search, setSearch] = React.useState("")
  const { data: bookmarks = [], isLoading } = useBookmarks()
  const toggleBookmark = useToggleBookmark()

  const filteredCourses = React.useMemo(() => {
    if (!search.trim()) return bookmarks
    const q = search.toLowerCase()
    return bookmarks.filter(
      (c) =>
        c.courseTitle.toLowerCase().includes(q) ||
        c.instructorName.toLowerCase().includes(q)
    )
  }, [bookmarks, search])

  return (
    <>
      <Topbar title="Bookmarks" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
              Bookmarks
            </h1>
            <p className="mt-1 text-[15px] text-ws-muted">
              Courses you&apos;ve saved for later.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : bookmarks.length === 0 ? (
            <EmptyState
              art={<ArtBookmarks />}
              title="Nothing saved yet"
              description="Tap the bookmark on any course to keep it here for later."
              actionLabel="Browse courses"
              actionHref="/dashboard/courses"
            />
          ) : (
            <>
              {/* SearchField per 04-components: pill, bg/chip, 16px glyph */}
              <div className="relative max-w-sm">
                <SearchIcon
                  
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ws-subtle" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bookmarks…"
                  className="h-10 w-full rounded-full bg-ws-chip pl-11 pr-4 text-sm text-ws-primary outline-none transition-colors duration-[var(--ws-motion-fast)] placeholder:text-ws-subtle focus:ring-[1.5px] focus:ring-ws-brand"
                />
              </div>

              {filteredCourses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[13px] text-ws-muted">
                  <p>No courses match &quot;{search}&quot;</p>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-1 text-[13px] font-medium text-ws-gold hover:opacity-80"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      href={`/dashboard/courses/${course.courseId}`}
                      title={course.courseTitle}
                      thumbnailUrl={course.courseThumbnail}
                      instructorName={course.instructorName}
                      instructorAvatarUrl={course.instructorAvatarUrl}
                      price={course.price}
                      pricing={course.pricing}
                      rating={course.rating}
                      level={course.level}
                      enrolledCount={course.enrolledCount}
                      isBookmarked
                      onToggleBookmark={() => toggleBookmark.mutate(course.courseId)}
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
