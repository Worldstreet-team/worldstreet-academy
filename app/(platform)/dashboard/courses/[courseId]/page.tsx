import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { levelTextStyle } from "@/components/shared/level-badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Topbar } from "@/components/platform/topbar"
import {
  fetchPublicCourse,
  fetchInstructorPublicCourses,
  fetchEnrolledCoursesFromInstructor,
  fetchOtherCourses,
  fetchProgramById,
} from "@/lib/actions/student"
import { checkEnrollment } from "@/lib/actions/enrollments"
import { getCourseAccess } from "@/lib/course-access"
import { CourseSchedulingCta } from "@/components/shared/course-scheduling-cta"
import { courseAvailability } from "@/lib/types/course"
import { getCurrentUser } from "@/lib/auth"
import { LessonPreviewAccordion } from "@/components/courses/lesson-preview-accordion"
import { AboutInstructor } from "@/components/courses/about-instructor"
import { BookmarkButton } from "@/components/courses/bookmark-button"
import { CourseResources } from "@/components/learn/course-resources"
import { CourseExamCard } from "@/components/courses/course-exam-card"
import { CourseOutcomes } from "@/components/courses/course-outcomes"
import { CourseReviews } from "@/components/courses/course-reviews"
import { CourseCarousel } from "@/components/learn/course-carousel"
import { ChevronLeftIcon, GraduationCapIcon, StarIcon } from "lucide-react"
import { programRail, programStats } from "@/lib/program-rail"
import { PackageLadder } from "@/components/programs/package-ladder"
import type { ProgramAccess } from "@/components/programs/access"
import { CardShell } from "@/components/ui/system"

// Force dynamic rendering to show fresh instructor avatars
export const revalidate = 0

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const course = await fetchPublicCourse(courseId)
  if (!course) notFound()

  // Get first lesson ID for "Start Learning" button
  const firstLessonId = course.lessons[0]?.id ?? "none"

  // Fetch instructor courses + enrollment status + recommendations in parallel
  const currentUser = await getCurrentUser()
  const [instructorCourses, enrolledFromInstructor, enrollmentStatus, otherCourses, program] =
    await Promise.all([
      fetchInstructorPublicCourses(course.instructorId),
      fetchEnrolledCoursesFromInstructor(course.instructorId).catch(() => []),
      currentUser
        ? checkEnrollment(currentUser.id, courseId)
        : Promise.resolve({ isEnrolled: false, status: undefined as string | undefined, resumeLessonId: null }),
      fetchOtherCourses(courseId),
      fetchProgramById(courseId),
    ])
  const isEnrolled = enrollmentStatus.isEnrolled

  // Q&A follows the package; visitors without an enrollment keep today's behaviour.
  const courseAccess = currentUser ? await getCourseAccess(currentUser.id, courseId) : null

  const isComingSoon =
    courseAvailability({ status: "published", availableAt: course.availableAt }) === "coming_soon"
  const isPreEnrolled = enrollmentStatus.status === "pre_enrolled"

  const rail = programRail({
    isEnrolled,
    packageName: courseAccess?.packageName ?? null,
    pricing: course.pricing,
    price: course.price,
    tierCount: program?.tierCount ?? 0,
  })
  const stats = programStats(course)
  const packages = program?.packages ?? []
  // The on-page ladder answers "which package?" before checkout does.
  const showLadder = !isEnrolled && !isPreEnrolled && packages.length > 1
  const ladderAccess: ProgramAccess = isComingSoon ? { kind: "coming_soon" } : { kind: "open" }

  // Calculate instructor's average rating across all their courses
  const ratedInstructorCourses = instructorCourses.filter((c) => c.rating != null && c.rating > 0)
  const instructorAvgRating =
    ratedInstructorCourses.length > 0
      ? ratedInstructorCourses.reduce((sum, c) => sum + (c.rating ?? 0), 0) / ratedInstructorCourses.length
      : undefined

  // Filter out the current course from instructor's courses
  const otherInstructorCourses = instructorCourses.filter(
    (c) => c.id !== course.id
  )

  // Shared CTA — the exact enroll/continue/resume routing, rendered in both
  // the desktop rail and the mobile action bar. Scheduled courses get the
  // countdown + pre-enroll face until the customer is actually active.
  const cta = isComingSoon || isPreEnrolled ? (
    <CourseSchedulingCta
      courseId={course.id}
      availableAt={course.availableAt}
      isComingSoon={isComingSoon}
      preEnrollEnabled={course.preEnrollEnabled}
      isPreEnrolled={isPreEnrolled}
      isPaid={course.pricing === "paid"}
      price={course.price}
      signedIn={Boolean(currentUser)}
    />
  ) : isEnrolled ? (
    <Link
      href={`/dashboard/courses/${course.id}/learn/${enrollmentStatus.resumeLessonId ?? firstLessonId}`}
      className="flex h-11 flex-1 items-center justify-center rounded-full bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
    >
      Continue learning
    </Link>
  ) : (
    <Link
      href={showLadder ? "#packages" : `/dashboard/checkout?courseId=${course.id}`}
      className="flex h-11 flex-1 items-center justify-center rounded-full bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
    >
      {rail.buyLabel}
    </Link>
  )

  return (
    <>
      <Topbar
        title={course.title}
        breadcrumbOverrides={{ [courseId]: course.title }}
      />
      <div className="flex-1 pb-44 md:pb-24 lg:pb-12">
        {/* Hero thumbnail — edge-to-edge on mobile */}
        <div className="relative aspect-video md:aspect-[21/9] w-full bg-ws-raised overflow-hidden">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
                <GraduationCapIcon size={20} aria-hidden />
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Overlay content */}
          <div className="absolute bottom-0 inset-x-0 p-4 md:p-6 lg:p-8 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="text-[10px] border border-white/20 bg-black/55 text-white">
                {rail.headline}
              </Badge>
              <Badge
                className="text-[10px] capitalize border border-white/20 bg-black/55 text-white"
                style={levelTextStyle(course.level)}
              >
                {course.level}
              </Badge>
              {course.rating && (
                <div className="inline-flex items-center gap-1 rounded-md bg-black/55 border border-white/20 px-1.5 py-0.5">
                  <StarIcon
                    
                    size={12}
                    className="text-ws-rating"
                    fill="currentColor" />
                  <span className="text-[11px] font-medium text-white">
                    {course.rating}
                  </span>
                </div>
              )}
            </div>
            <h1 className="font-display text-xl md:text-2xl lg:text-3xl font-semibold tracking-[-0.02em] text-white leading-tight">
              {course.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <Avatar size="sm" className="border border-white/30">
                {course.instructorAvatarUrl && (
                  <AvatarImage
                    src={course.instructorAvatarUrl}
                    alt={course.instructorName}
                  />
                )}
                <AvatarFallback className="text-[10px]">
                  {course.instructorName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{course.instructorName}</span>
              {course.enrolledCount > 0 && (
                <>
                  <span className="text-white/50">·</span>
                  <span>{course.enrolledCount.toLocaleString()} enrolled</span>
                </>
              )}
            </div>
          </div>

          {/* Back button */}
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href="/dashboard/courses" />}
            className="absolute top-3 left-3 bg-black/30 text-white hover:bg-black/50 border border-white/10"
          >
            <ChevronLeftIcon  size={16} />
          </Button>

          {/* Bookmark — the desktop buy rail has its own; hide this one on lg+ */}
          <BookmarkButton
            courseId={course.id}
            className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white hover:bg-black/50 transition-all lg:hidden"
          />
        </div>

        {/* Content + sticky buy rail */}
        <div className="p-4 md:p-6 lg:p-8">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
            <div className="min-w-0 space-y-6">
              {/* Quick stats */}
              {stats.length > 0 && (
                <CardShell className="h-auto flex-row divide-x divide-border">
                  {stats.map((stat) => (
                    <div key={stat.label} className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-4">
                      <span className="font-display text-[22px] font-light leading-none tabular-nums tracking-[-0.02em] text-foreground">
                        {stat.value}
                      </span>
                      <span className="text-[12px] text-muted-foreground">{stat.label}</span>
                    </div>
                  ))}
                </CardShell>
              )}

              {/* Description */}
              <div className="space-y-2">
                <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">
                  About this program
                </h2>
                <p className="text-sm text-ws-muted leading-relaxed">
                  {course.description}
                </p>
              </div>

              {/* What you'll learn · requirements · audience */}
              <CourseOutcomes
                whatYouWillLearn={course.whatYouWillLearn}
                requirements={course.requirements}
                targetAudience={course.targetAudience}
              />
            </div>

            {/* Sticky buy rail — desktop only. Ends here: the package ladder and
                the sections below it need the full page width, not this
                340px-narrower column (controller fix round 1). */}
            <aside className="hidden lg:sticky lg:top-20 lg:block">
              <div className="rounded-[20px] border border-ws-hairline bg-ws-surface p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-3xl font-semibold tabular-nums tracking-[-0.02em] text-ws-primary">
                    {rail.headline}
                  </p>
                  <span className="rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
                    {rail.note}
                  </span>
                </div>

                <dl className="mt-5 space-y-2.5 border-t border-ws-hairline pt-5 text-sm">
                  {stats.map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between">
                      <dt className="text-ws-muted">{stat.label}</dt>
                      <dd className="font-medium tabular-nums text-ws-primary">{stat.value}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <dt className="text-ws-muted">Level</dt>
                    <dd className="font-medium capitalize text-ws-primary">
                      {course.level}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex items-center gap-2">
                  {cta}
                  <BookmarkButton
                    courseId={course.id}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-ws-hairline text-ws-muted transition-colors hover:bg-ws-raised hover:text-ws-primary"
                  />
                </div>
              </div>
            </aside>
          </div>

          {/* Package ladder — full page width; the rail above ends before it so
             three tiers get comfortable room instead of the 940px main column. */}
          {showLadder && <PackageLadder courseId={course.id} packages={packages} access={ladderAccess} />}

          <div className={showLadder ? "mt-10 space-y-6" : "space-y-6"}>
            {/* Reviews */}
            <CourseReviews courseId={course.id} />

            {/* CBT exam — visible to enrolled students when the course has one */}
            {isEnrolled && <CourseExamCard courseId={course.id} />}

            {/* Curriculum with thumbnails and previews */}
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">
                Curriculum{" "}
                {course.lessons.length > 0 && (
                  <span className="text-ws-muted font-sans font-normal text-sm">
                    ({course.lessons.length} lessons)
                  </span>
                )}
              </h2>
              {course.lessons.length > 0 ? (
                <LessonPreviewAccordion
                  lessons={course.lessons}
                  courseId={course.id}
                  coursePricing={course.pricing}
                  coursePrice={course.price}
                />
              ) : (
                <p className="text-sm text-ws-muted py-4 text-center">
                  Curriculum details coming soon.
                </p>
              )}
            </div>

            {/* Included materials — locked until enrolled, but visible so buyers
                can see what the course comes with. */}
            <CourseResources courseId={course.id} />

            {/* About Instructor */}
            <AboutInstructor
              instructorId={course.instructorId}
              instructorName={course.instructorName}
              instructorAvatarUrl={course.instructorAvatarUrl}
              instructorBio={course.instructorBio}
              instructorHeadline={course.instructorHeadline}
              otherCourses={otherInstructorCourses}
              enrolledCourses={enrolledFromInstructor}
              totalStudents={Math.max(course.instructorTotalStudents, course.enrolledCount)}
              averageRating={instructorAvgRating}
              canMessage={courseAccess ? courseAccess.entitlements.instructorQa : true}
            />
          </div>

          {/* Related courses */}
          {otherCourses.length > 0 && (
            <div className="mt-10">
              <CourseCarousel courses={otherCourses} title="Learners also viewed" />
            </div>
          )}
        </div>

        {/* Mobile/tablet action bar — sits above the bottom nav on mobile,
            flush to the viewport bottom once the nav disappears at md */}
        <div className="fixed inset-x-0 bottom-[60px] z-40 rounded-t-[20px] border-t border-ws-hairline bg-ws-surface px-4 py-3 md:bottom-0 lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] text-ws-subtle">
                {isEnrolled ? "Your package" : rail.note}
              </p>
              <p className="font-display text-xl font-semibold tabular-nums tracking-[-0.02em] text-ws-primary">
                {isEnrolled ? rail.note : rail.headline}
              </p>
            </div>
            <div className="flex max-w-60 flex-1 justify-end">{cta}</div>
          </div>
        </div>
      </div>
    </>
  )
}
