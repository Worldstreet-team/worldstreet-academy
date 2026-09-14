"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { CourseCard, CourseCardSkeleton } from "@/components/platform/course-card"
import { EnrollmentCard } from "@/components/platform/enrollment-card"
import { Mascot } from "@/components/platform/mascot"
import { Button } from "@/components/ui/button"
import {
  CertificatesTile,
  CommunityTile,
  CurrentCourseTile,
  InstructorsTile,
  ProgressTile,
  SupportTile,
  UpcomingClassesTile,
} from "@/components/dashboard/home-tiles"
import { BRAND } from "@/lib/brand"
import {
  enrollmentHref,
  hasPrioritySupport,
  includesAny,
  instructorRows,
  pickCurrent,
  pickResume,
} from "@/lib/dashboard-home"
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
 * Section header — title left, a quiet "See all" right. Gold on this page
 * belongs to the Continue learning CTA alone.
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
          className="group inline-flex items-center gap-1 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
        >
          {linkLabel}
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
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

/** Compact empty state that sits in a section's flow; the hero CTA carries the action. */
function SectionEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg bg-ws-surface px-6 py-8">
      <p className="text-[15px] font-semibold text-ws-primary">{title}</p>
      <p className="mt-1 text-[13px] text-ws-muted">{description}</p>
    </div>
  )
}

export default function DashboardPage() {
  const user = useUser()
  // The checkout success page's "Go to dashboard" links here with ?welcome=1.
  const welcome = useSearchParams().get("welcome") === "1"

  const { data: enrollments = [], isLoading: isLoadingEnrollments } = useEnrollments()
  const { data: bookmarks = [], isLoading: isLoadingBookmarks } = useBookmarks()
  const { data: browseCourses = [], isLoading: isLoadingBrowse } = useBrowseCourses()
  const bookmarkedIds = useBookmarkedIds()
  const toggleBookmark = useToggleBookmark()

  const resume = pickResume(enrollments)
  const current = pickCurrent(enrollments)
  const instructors = instructorRows(enrollments)
  // Tiles the student's packages can't back are hidden, never faked.
  const showUpcomingClasses = includesAny(enrollments, "liveClasses")
  const showCertificates = includesAny(enrollments, "certificate")

  return (
    <>
      <Topbar title="Dashboard" />

      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-12">
          {/* Welcome band + the page's one gold CTA (spec §12 "Continue learning →") */}
          <header className="ws-animate-in rounded-lg bg-ws-surface">
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center md:gap-10 md:p-8">
              <Mascot size={150} className="h-[96px] w-[96px] shrink-0 md:h-[130px] md:w-[130px]" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary md:text-[34px]">
                  {welcome ? `Welcome to ${BRAND.name}` : `${getGreeting()}, ${user.firstName}`}
                </h1>
                <p className="mt-2 text-[15px] text-ws-muted">
                  {welcome
                    ? "Your learning journey starts now."
                    : "Pick up where you left off, or discover something new."}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {isLoadingEnrollments ? (
                    <div className="h-11 w-48 animate-pulse rounded-sm bg-ws-raised" />
                  ) : resume ? (
                    <>
                      <Button size="lg" className="h-11 gap-2 px-6" render={<Link href={enrollmentHref(resume)} />}>
                        Continue learning
                        <ArrowRight size={16} aria-hidden />
                      </Button>
                      <span className="max-w-full truncate text-[13px] text-ws-muted">{resume.courseTitle}</span>
                    </>
                  ) : (
                    <Button size="lg" className="h-11 gap-2 px-6" render={<Link href="/dashboard/courses" />}>
                      Browse programs
                      <ArrowRight size={16} aria-hidden />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* MY PROGRAMS */}
          <section>
            <SectionHeader
              title="My programs"
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
                description="Choose a program and it'll show up here with your progress."
              />
            ) : (
              <CourseGrid>
                {enrollments.slice(0, 3).map((enrollment) => (
                  <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                ))}
              </CourseGrid>
            )}
          </section>

          {/* Spec §12 tiles, in spec order. A uniform grid: tiles hide per student,
              so fixed column spans would leave holes. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CurrentCourseTile enrollment={current} isLoading={isLoadingEnrollments} />
            <ProgressTile enrollments={enrollments} isLoading={isLoadingEnrollments} />
            {showUpcomingClasses && <UpcomingClassesTile />}
            {showCertificates && <CertificatesTile />}
            {instructors.length > 0 && <InstructorsTile rows={instructors} />}
            <CommunityTile />
            <SupportTile priority={hasPrioritySupport(enrollments)} />
          </div>

          {/* Browse programs */}
          <section>
            <SectionHeader title="Browse programs" href="/dashboard/courses" />
            {isLoadingBrowse ? (
              <CourseGrid>
                {[0, 1, 2].map((i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </CourseGrid>
            ) : browseCourses.length === 0 ? (
              <SectionEmpty
                title="No programs published yet"
                description="New programs will appear here as instructors publish them."
              />
            ) : (
              <CourseGrid>
                {browseCourses.slice(0, 3).map((course) => (
                  <CourseCard
                    key={course.id}
                    href={`/dashboard/courses/${course.id}`}
                    title={course.title}
                    thumbnailUrl={course.thumbnailUrl}
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

          {/* Bookmarks — only when there are any. */}
          {(isLoadingBookmarks || bookmarks.length > 0) && (
            <section>
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
