"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { CourseCard, CourseCardSkeleton } from "@/components/platform/course-card"
import { AssignmentsTile } from "@/components/dashboard/assignments-tile"
import { HomeBento, type BentoTile } from "@/components/dashboard/home-bento"
import { HeroStats, HeroStatsSkeleton } from "@/components/dashboard/home-strip"
import {
  CertificatesTile,
  InstructorsTile,
  MyProgramsTile,
  SupportTile,
  UpcomingClassesTile,
} from "@/components/dashboard/home-tiles"
import { HomeGreeting, HomeSummary, LearningHero, LearningHeroSkeleton } from "@/components/dashboard/learning-hero"
import { TileSkeleton } from "@/components/dashboard/tile-bits"
import { useUser } from "@/components/providers/user-provider"
import { CardShell, EmptyState, Eyebrow, Rise } from "@/components/ui/system"
import {
  assessmentCounts,
  hasPrioritySupport,
  includesAny,
  instructorRows,
  learningTotals,
  notEnrolled,
  pickHero,
} from "@/lib/dashboard-home"
import {
  useBookmarkedIds,
  useBookmarks,
  useBrowseCourses,
  useEnrollments,
  useMyAssessments,
  useMyCertificates,
  useToggleBookmark,
} from "@/lib/hooks/queries"
import { useNow } from "@/lib/hooks/use-now"

/*
 * The student home, in the hub's order (design-system 05): greeting row →
 * learning hero (the program, its progress, and the student's totals as the
 * card's foot) → paired bento rows → Discover. Three bands, each a different
 * shape: one card, a grid of cards, a grid of course cards. The stat pills and
 * the action rail that used to sit between the hero and the grid are gone
 * (2026-09-16) — the figures moved into the hero, and every rail pill was
 * already a sidebar row. Sections enter on the Rise cascade, ~60ms apart;
 * there is no ambient motion.
 */

/** Section heading outside a card: Poppins 20, with a quiet "See all". Gold on this page belongs to the hero's CTA. */
function SectionHeading({
  id,
  title,
  subtitle,
  href,
  tour,
}: {
  id: string
  title: string
  subtitle: string
  href: string
  /** `data-tour` key, when the dashboard tour stops here. */
  tour?: string
}) {
  return (
    <div className="flex items-end justify-between gap-4" data-tour={tour}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className="font-display text-[20px] font-semibold leading-tight tracking-[-0.015em]">
          {title}
        </h2>
        <p className="text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        See all
        <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  )
}

/**
 * Two cards on a phone and in halves, three from ~896px of page width — the
 * third card only appears where there is a column for it.
 */
function CourseGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3 [&>*:nth-child(3)]:hidden @4xl:[&>*:nth-child(3)]:block">
      {children}
    </div>
  )
}

function CourseGridSkeleton() {
  return (
    <CourseGrid>
      {[0, 1, 2].map((i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </CourseGrid>
  )
}

export default function DashboardPage() {
  const user = useUser()
  // The checkout success page's "Go to dashboard" links here with ?welcome=1.
  const welcome = useSearchParams().get("welcome") === "1"
  const now = useNow()

  const { data: enrollments = [], isLoading: loadingEnrollments } = useEnrollments()
  const { data: assessments = [], isLoading: loadingAssessments } = useMyAssessments()
  const { data: bookmarks = [], isLoading: loadingBookmarks } = useBookmarks()
  const { data: browseCourses = [], isLoading: loadingBrowse } = useBrowseCourses()
  const bookmarkedIds = useBookmarkedIds()
  const toggleBookmark = useToggleBookmark()

  const hero = pickHero(enrollments, now)
  const totals = learningTotals(enrollments)
  const instructors = instructorRows(enrollments)
  // Tiles the student's packages can't back are hidden, never faked.
  const showClasses = includesAny(enrollments, "liveClasses")
  const showCertificates = includesAny(enrollments, "certificate")
  // Certificates are read here (not only in the tile) because the tile exists
  // only once one is earned — the hero's foot already carries the count, and
  // an empty certificates card said nothing the figure doesn't.
  const { data: certificates = [], isLoading: loadingCertificates } = useMyCertificates(showCertificates)
  const { toDo } = assessmentCounts(assessments)
  // The hero already shows its program; the list earns its place with a row the hero doesn't.
  const showPrograms = enrollments.some((e) => e.id !== hero?.enrollment.id)

  // Every query that changes the tile set (and the summary built from the
  // same rows): until all of them land, tiles show skeletons, so the bento
  // is paired once and nothing re-pairs, remounts or replays Rise.
  const loadingTiles = loadingEnrollments || loadingAssessments || (showCertificates && loadingCertificates)

  // Priority order; home-bento pairs wide lists with narrow tiles.
  const tiles: BentoTile[] = []
  if (showPrograms) {
    tiles.push({ key: "programs", prefer: "wide", node: <MyProgramsTile enrollments={enrollments} now={now} /> })
  }
  if (assessments.length > 0) {
    // A list of one or two rows stretched across a wide slot is mostly empty
    // card; it takes a narrow slot until there is a list to fill the wide one.
    tiles.push({ key: "assignments", prefer: assessments.length > 2 ? "wide" : "narrow", node: <AssignmentsTile /> })
  }
  if (showClasses) tiles.push({ key: "classes", prefer: "narrow", node: <UpcomingClassesTile now={now} /> })
  if (instructors.length > 0) {
    tiles.push({ key: "instructors", prefer: "narrow", node: <InstructorsTile rows={instructors} /> })
  }
  if (showCertificates && certificates.length > 0) {
    tiles.push({ key: "certificates", prefer: "narrow", node: <CertificatesTile now={now} /> })
  }
  tiles.push({ key: "support", prefer: "narrow", node: <SupportTile priority={hasPrioritySupport(enrollments)} /> })

  // Programs the student already has would only repeat the list above.
  const recommended = notEnrolled(browseCourses, enrollments).slice(0, 3)
  const loadingDiscover = loadingBrowse || loadingEnrollments
  const showBrowse = loadingDiscover || browseCourses.length === 0 || recommended.length > 0
  const showBookmarks = loadingBookmarks || bookmarks.length > 0
  const bentoDelay = 120
  const discoverDelay = Math.min(bentoDelay + 60 * (loadingTiles ? 2 : tiles.length), 420)

  return (
    <>
      <Topbar title="Dashboard" />

      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:px-8 md:pb-12 md:pt-8 lg:px-12">
        <div className="@container mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="relative">
            {/* The one ambient gold the system allows: a static warm radial behind
                the hero, dark mode only (design-system 01, "Ambient brand glow"). */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-6 hidden h-[36rem] dark:block"
              style={{ background: "radial-gradient(680px 440px at 68% 42%, var(--color-ws-glow), transparent 70%)" }}
            />
            <div className="relative flex flex-col gap-5">
              <Rise>
                <HomeGreeting
                  firstName={user.firstName}
                  welcome={welcome}
                  summary={
                    <HomeSummary
                      enrollments={enrollments}
                      toDo={toDo}
                      now={now}
                      welcome={welcome}
                      loading={loadingTiles}
                      withClasses={showClasses}
                    />
                  }
                />
              </Rise>
              <Rise delay={60}>
                {/* The tour spotlights the hero: its wrapper, so the stop holds through the skeleton. */}
                <div data-tour="hero">
                  {loadingEnrollments ? (
                    <LearningHeroSkeleton footer={<HeroStatsSkeleton />} />
                  ) : (
                    <LearningHero
                      hero={hero}
                      hasEnrollments={enrollments.length > 0}
                      // The foot counts only once there is something real to count.
                      footer={
                        totals.open > 0 ? (
                          <HeroStats
                            totals={totals}
                            showCertificates={showCertificates}
                            showClasses={showClasses}
                            now={now}
                          />
                        ) : null
                      }
                    />
                  )}
                </div>
              </Rise>
            </div>
          </div>

          {loadingTiles ? (
            <div className="grid gap-4 @2xl:grid-cols-2 @4xl:grid-cols-5">
              <Rise delay={bentoDelay} className="min-w-0 @4xl:col-span-3 [&>div]:h-full">
                <TileSkeleton rows={4} label="Loading your programs" />
              </Rise>
              <Rise delay={bentoDelay + 60} className="min-w-0 @4xl:col-span-2 [&>div]:h-full">
                <TileSkeleton rows={3} />
              </Rise>
            </div>
          ) : (
            <HomeBento tiles={tiles} delay={bentoDelay} />
          )}

          {(showBrowse || showBookmarks) && (
            <Rise delay={discoverDelay} className="flex items-center gap-3 pt-2">
              <Eyebrow>Discover</Eyebrow>
              <div className="h-px flex-1 bg-border" />
            </Rise>
          )}

          {showBrowse && (
            <Rise delay={discoverDelay + 60}>
              <section aria-labelledby="home-browse" className="flex flex-col gap-4">
                <SectionHeading
                  id="home-browse"
                  tour="browse-section"
                  title="Browse programs"
                  subtitle={enrollments.length > 0 ? "Programs you haven't started" : "Expert-led, across every school"}
                  href="/dashboard/courses"
                />
                {loadingDiscover ? (
                  <CourseGridSkeleton />
                ) : browseCourses.length === 0 ? (
                  <CardShell>
                    <EmptyState
                      illustration="noTransactions"
                      title="No programs published yet"
                      description="New programs appear here as instructors publish them."
                    />
                  </CardShell>
                ) : (
                  <CourseGrid>
                    {recommended.map((course) => (
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
            </Rise>
          )}

          {/* Bookmarks — only when there are any. */}
          {showBookmarks && (
            <Rise delay={discoverDelay + 120}>
              <section aria-labelledby="home-bookmarks" className="flex flex-col gap-4">
                <SectionHeading id="home-bookmarks" title="Bookmarks" subtitle="Saved for later" href="/dashboard/bookmarks" />
                {loadingBookmarks ? (
                  <CourseGridSkeleton />
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
            </Rise>
          )}
        </div>
      </div>
    </>
  )
}
