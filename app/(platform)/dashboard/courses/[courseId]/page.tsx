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
} from "@/lib/actions/student"
import { checkEnrollment } from "@/lib/actions/enrollments"
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
import { BookOpenIcon, ChevronLeftIcon, ClockIcon, StarIcon, UsersIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

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

  const totalHours = Math.floor(course.totalDuration / 60)
  const totalMins = course.totalDuration % 60
  const durationLabel =
    totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`

  // Get first lesson ID for "Start Learning" button
  const firstLessonId = course.lessons[0]?.id ?? "none"

  // Fetch instructor courses + enrollment status + recommendations in parallel
  const currentUser = await getCurrentUser()
  const [instructorCourses, enrolledFromInstructor, enrollmentStatus, otherCourses] =
    await Promise.all([
      fetchInstructorPublicCourses(course.instructorId),
      fetchEnrolledCoursesFromInstructor(course.instructorId).catch(() => []),
      currentUser
        ? checkEnrollment(currentUser.id, courseId)
        : Promise.resolve({ isEnrolled: false, status: undefined as string | undefined, resumeLessonId: null }),
      fetchOtherCourses(courseId),
    ])
  const isEnrolled = enrollmentStatus.isEnrolled

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

  const priceLabel = course.pricing === "free" ? "Free" : `$${course.price}`

  const isComingSoon =
    courseAvailability({ status: "published", availableAt: course.availableAt }) === "coming_soon"
  const isPreEnrolled = enrollmentStatus.status === "pre_enrolled"

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
      className="flex h-11 flex-1 items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
    >
      Continue Learning
    </Link>
  ) : (
    <Link
      href={`/dashboard/checkout?courseId=${course.id}`}
      className="flex h-11 flex-1 items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
    >
      Enroll Now
      {course.pricing !== "free" && (
        <span className="ml-1.5 font-normal opacity-80">· ${course.price}</span>
      )}
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
              <span className="text-ws-muted">Course Thumbnail</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Overlay content */}
          <div className="absolute bottom-0 inset-x-0 p-4 md:p-6 lg:p-8 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="text-[10px] border border-white/20 bg-black/55 text-white">
                {priceLabel}
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
              <span className="text-white/50">·</span>
              <span>{course.enrolledCount.toLocaleString()} students</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  {
                    icon: BookOpenIcon,
                    value: course.totalLessons,
                    label: "Lessons",
                  },
                  { icon: ClockIcon, value: durationLabel, label: "Duration" },
                  {
                    icon: UsersIcon,
                    value: course.enrolledCount.toLocaleString(),
                    label: "Students",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-2.5 rounded-lg border border-ws-hairline bg-ws-surface p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ws-raised">
                      <RenderIcon icon={stat.icon}
                        
                        size={16}
                        className="text-ws-gold" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-none tabular-nums text-ws-primary">
                        {stat.value}
                      </p>
                      <p className="text-[10px] text-ws-muted mt-0.5">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">
                  About this course
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

              {/* Reviews */}
              <CourseReviews courseId={course.id} />

              {/* CBT exam — visible to enrolled students when the course has one */}
              {isEnrolled && <CourseExamCard courseId={course.id} />}

              {/* Curriculum with thumbnails and previews */}
              <div className="space-y-3">
                <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">
                  Curriculum{" "}
                  <span className="text-ws-muted font-sans font-normal text-sm">
                    ({course.lessons.length} lessons)
                  </span>
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
                totalStudents={course.instructorTotalStudents}
                averageRating={instructorAvgRating}
              />
            </div>

            {/* Sticky buy rail — desktop only */}
            <aside className="hidden lg:sticky lg:top-20 lg:block">
              <div className="rounded-lg border border-ws-hairline bg-ws-surface p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-3xl font-semibold tabular-nums tracking-[-0.02em] text-ws-primary">
                    {priceLabel}
                  </p>
                  <span className="rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
                    {course.pricing === "free" ? "Full access" : "One-time purchase"}
                  </span>
                </div>

                <dl className="mt-5 space-y-2.5 border-t border-ws-hairline pt-5 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-ws-muted">Lessons</dt>
                    <dd className="font-medium tabular-nums text-ws-primary">
                      {course.totalLessons}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ws-muted">Duration</dt>
                    <dd className="font-medium tabular-nums text-ws-primary">
                      {durationLabel}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ws-muted">Level</dt>
                    <dd className="font-medium capitalize text-ws-primary">
                      {course.level}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ws-muted">Students</dt>
                    <dd className="font-medium tabular-nums text-ws-primary">
                      {course.enrolledCount.toLocaleString()}
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

          {/* Related courses */}
          {otherCourses.length > 0 && (
            <div className="mt-10">
              <CourseCarousel courses={otherCourses} title="Students also viewed" />
            </div>
          )}
        </div>

        {/* Mobile/tablet action bar — sits above the bottom nav on mobile,
            flush to the viewport bottom once the nav disappears at md */}
        <div className="fixed inset-x-0 bottom-[60px] z-40 border-t border-ws-hairline bg-ws-surface px-4 py-3 md:bottom-0 lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] text-ws-subtle">
                {isEnrolled ? "Enrolled" : course.pricing === "free" ? "Full access" : "Price"}
              </p>
              <p className="font-display text-xl font-semibold tabular-nums tracking-[-0.02em] text-ws-primary">
                {priceLabel}
              </p>
            </div>
            <div className="flex max-w-60 flex-1 justify-end">{cta}</div>
          </div>
        </div>
      </div>
    </>
  )
}
