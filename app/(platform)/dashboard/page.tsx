"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { CourseCard, CourseCardSkeleton } from "@/components/platform/course-card"
import { Mascot } from "@/components/platform/mascot"
import type { StudentEnrollment } from "@/lib/actions/student"

import {
  useEnrollments,
  useBookmarks,
  useBookmarkedIds,
  useBrowseCourses,
  useToggleBookmark,
} from "@/lib/hooks/queries"
import { useUser } from "@/components/providers/user-provider"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

/**
 * Section header — title left, "See all" gold link right, per the Academy Home
 * reference screen. Sections are separated by space, not by nested cards.
 */
function SectionHeader({
  title,
  href,
  linkLabel = "See all",
}: {
  title: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="font-display text-xl font-semibold tracking-[-0.015em] text-ws-primary">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1 text-[13px] font-medium text-ws-gold transition-opacity hover:opacity-80"
        >
          {linkLabel}
          <ArrowRight
            size={14}
            strokeWidth={2}
            aria-hidden
            className="transition-transform duration-[var(--ws-motion-fast)] group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </div>
  )
}

/** 3-up grid, 24px gutters — the reference's course grid. */
function CourseGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}

/**
 * Compact empty state, sized to sit in the flow of a course section rather
 * than dominate it. The shared `EmptyState` is a full-page block — at ~500px
 * tall it made an empty dashboard read as a broken page instead of a new one.
 */
function SectionEmpty({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-ws-hairline bg-ws-surface/40 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[15px] font-semibold text-ws-primary">{title}</p>
        <p className="mt-1 text-[13px] text-ws-muted">{description}</p>
      </div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-sm bg-ws-brand px-6 text-[15px] font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

/**
 * The learner's overall standing, shown inside the greeting pane: lessons
 * completed across every enrollment, one gold bar for overall progress, and
 * the in-progress / completed course split.
 */
function ProgressPane({
  enrollments,
  isLoading,
}: {
  enrollments: StudentEnrollment[]
  isLoading: boolean
}) {
  const totalLessons = enrollments.reduce((s, e) => s + (e.totalLessons ?? 0), 0)
  const completedLessons = enrollments.reduce(
    (s, e) => s + Math.round(((e.progress ?? 0) / 100) * (e.totalLessons ?? 0)),
    0
  )
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  const inProgress = enrollments.filter((e) => e.progress > 0 && e.progress < 100).length
  const completedCourses = enrollments.filter((e) => e.progress === 100).length

  if (isLoading) {
    return (
      <div className="w-full shrink-0 lg:w-80">
        <div className="h-3 w-32 animate-pulse rounded-full bg-ws-raised" />
        <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-ws-track" />
        <div className="mt-4 h-3 w-44 animate-pulse rounded-full bg-ws-raised" />
      </div>
    )
  }

  return (
    <div className="w-full shrink-0 lg:w-80">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">
          Overall progress
        </p>
        <p className="text-[13px] tabular-nums text-ws-muted">
          {totalLessons > 0 ? (
            <>
              <span className="font-semibold text-ws-primary">{completedLessons}</span>/
              {totalLessons} lessons
            </>
          ) : (
            "No lessons yet"
          )}
        </p>
      </div>

      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ws-track">
        <div
          className="h-full rounded-full bg-ws-brand"
          style={{ width: `${Math.max(overallPct, totalLessons > 0 ? 2 : 0)}%` }}
        />
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-4">
        <p className="tabular-nums">
          <span className="font-display text-xl font-semibold text-ws-primary">{overallPct}%</span>{" "}
          <span className="text-[13px] text-ws-muted">complete</span>
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
            <span className="font-semibold tabular-nums text-ws-primary">{inProgress}</span> in
            progress
          </span>
          <span className="rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
            <span className="font-semibold tabular-nums text-ws-primary">{completedCourses}</span>{" "}
            completed
          </span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const user = useUser()

  const { data: enrollments = [], isLoading: isLoadingEnrollments } = useEnrollments()
  const { data: bookmarks = [], isLoading: isLoadingBookmarks } = useBookmarks()
  const { data: browseCourses = [], isLoading: isLoadingBrowse } = useBrowseCourses()
  const bookmarkedIds = useBookmarkedIds()
  const toggleBookmark = useToggleBookmark()

  return (
    <>
      <Topbar title="Dashboard" />

      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-12">
          {/* Greeting pane — mascot + greeting on the left, the learner's
              overall standing on the right, on a quiet surface card. The
              lesson tally is derived from each course's progress × lesson
              count, which is exactly how `progress` itself is computed
              server-side, so the two never disagree. */}
          <header className="ws-animate-in relative overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface">
            <div className="relative flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
              <div className="flex min-w-0 items-center gap-6 md:gap-10">
                <Mascot
                  size={150}
                  className="h-[110px] w-[110px] shrink-0 md:h-[150px] md:w-[150px]"
                />
                <div className="min-w-0">
                  <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary md:text-[34px]">
                    {getGreeting()}, {user.firstName}
                  </h1>
                  <p className="mt-2 text-[15px] text-ws-muted">
                    Pick up where you left off, or discover something new.
                  </p>
                </div>
              </div>

              <ProgressPane
                enrollments={enrollments}
                isLoading={isLoadingEnrollments}
              />
            </div>
          </header>

          {/* My courses */}
          <section className="">
            <SectionHeader
              title="My courses"
              href={enrollments.length > 0 ? "/dashboard/my-courses" : undefined}
            />
            {isLoadingEnrollments ? (
              <CourseGrid>
                {[0, 1, 2].map((i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </CourseGrid>
            ) : enrollments.length === 0 ? (
              <SectionEmpty
                title="You're not enrolled in anything yet"
                description="Pick a course below and it'll show up here with your progress."
                actionLabel="Browse courses"
                actionHref="/dashboard/courses"
              />
            ) : (
              <CourseGrid>
                {enrollments.slice(0, 3).map((enrollment) => (
                  <CourseCard
                    key={enrollment.id}
                    href={`/dashboard/courses/${enrollment.courseId}/learn/${enrollment.resumeLessonId ?? enrollment.firstLessonId ?? "first"}`}
                    title={enrollment.courseTitle}
                    thumbnailUrl={enrollment.courseThumbnail}
                    instructorName={enrollment.instructorName}
                    instructorAvatarUrl={enrollment.instructorAvatarUrl}
                    progress={enrollment.progress}
                  />
                ))}
              </CourseGrid>
            )}
          </section>

          {/* Browse courses */}
          <section className="">
            <SectionHeader title="Browse courses" href="/dashboard/courses" />
            {isLoadingBrowse ? (
              <CourseGrid>
                {[0, 1, 2].map((i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </CourseGrid>
            ) : browseCourses.length === 0 ? (
              <SectionEmpty
                title="No courses published yet"
                description="New courses will appear here as instructors publish them."
              />
            ) : (
              <CourseGrid>
                {browseCourses.slice(0, 3).map((course) => (
                  <CourseCard
                    key={course.id}
                    href={`/dashboard/courses/${course.id}`}
                    title={course.title}
                    thumbnailUrl={course.thumbnailUrl}
                    instructorName={course.instructorName}
                    instructorAvatarUrl={course.instructorAvatarUrl}
                    price={course.price}
                    pricing={course.pricing}
                    rating={course.rating}
                    level={course.level}
                    totalLessons={course.totalLessons}
                    totalDuration={course.totalDuration}
                    enrolledCount={course.enrolledCount}
                    isBookmarked={bookmarkedIds.has(course.id)}
                    onToggleBookmark={() => toggleBookmark.mutate(course.id)}
                  />
                ))}
              </CourseGrid>
            )}
          </section>

          {/* Bookmarks — only when there are any. An empty-state block for a
              purely optional feature was pure vertical noise on the old page. */}
          {(isLoadingBookmarks || bookmarks.length > 0) && (
            <section className="">
              <SectionHeader title="Bookmarks" href="/dashboard/bookmarks" />
              {isLoadingBookmarks ? (
                <CourseGrid>
                  {[0, 1, 2].map((i) => (
                    <CourseCardSkeleton key={i} />
                  ))}
                </CourseGrid>
              ) : (
                <CourseGrid>
                  {bookmarks.slice(0, 3).map((bookmark) => (
                    <CourseCard
                      key={bookmark.id}
                      href={`/dashboard/courses/${bookmark.courseId}`}
                      title={bookmark.courseTitle}
                      thumbnailUrl={bookmark.courseThumbnail}
                      instructorName={bookmark.instructorName}
                      instructorAvatarUrl={bookmark.instructorAvatarUrl}
                      price={bookmark.price}
                      pricing={bookmark.pricing}
                      rating={bookmark.rating}
                      level={bookmark.level}
                      enrolledCount={bookmark.enrolledCount}
                      isBookmarked
                      onToggleBookmark={() => toggleBookmark.mutate(bookmark.courseId)}
                    />
                  ))}
                </CourseGrid>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
