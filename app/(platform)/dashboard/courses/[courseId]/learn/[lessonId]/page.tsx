import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { fetchCourseForLearning, fetchOtherCourses, getCompletedLessons } from "@/lib/actions/student"
import { updateLastAccessed } from "@/lib/actions/enrollments"
import { getCourseRatingSummary, getUserReview } from "@/lib/actions/reviews"
import { getCourseWatchProgress } from "@/lib/actions/watch-progress"
import { getCurrentUser } from "@/lib/auth"
import { getCourseAccess, getLearnStart, openPublishedLessonIds } from "@/lib/course-access"
import { CourseExamCard } from "@/components/courses/course-exam-card"
import { MarkCompleteButton } from "@/components/learn/mark-complete-button"
import { MessageInstructorButton } from "@/app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button"
import { LessonVideoPlayer } from "@/components/learn/lesson-video-player"
import { LessonQuizCard } from "@/components/learn/lesson-quiz-card"
import { LessonSidebar } from "@/components/learn/lesson-sidebar"
import { CourseCarousel } from "@/components/learn/course-carousel"
import { MobileLessonList } from "@/components/learn/mobile-lesson-list"
import { CourseRating } from "@/components/learn/course-rating"
import { RichTextContent } from "@/components/ui/rich-text-editor"
import { FinishCourseButton } from "@/components/learn/finish-course-button"
import { CourseResources } from "@/components/learn/course-resources"
import { PackageLockNotice } from "@/components/learn/package-lock-notice"
import { PACKAGE_LABEL } from "@/lib/entitlements"

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const { courseId, lessonId } = await params
  const course = await fetchCourseForLearning(courseId)
  if (!course) notFound()

  // Content is gated on enrollment server-side; send non-enrolled users to the
  // course page, which forwards them to the program page to enroll.
  if (!course.hasAccess) redirect(`/dashboard/courses/${courseId}`)

  const lessons = course.lessons
  const coursePage = `/dashboard/courses/${courseId}`
  const currentUser = await getCurrentUser()
  // Course staff (admin, or the course's own instructor) have no enrollment,
  // so `getCourseAccess` reads null for them.
  const access = currentUser ? await getCourseAccess(currentUser.id, courseId) : null

  let currentLesson = lessons.find((l) => l.id === lessonId)
  if (!currentLesson) {
    // A stale or placeholder id (`/learn/first`): a learner goes to where they
    // start, or to the course page's waiting state while nothing is open yet;
    // staff previewing keep the first lesson.
    const start = access && currentUser ? await getLearnStart(currentUser.id, courseId) : null
    if (start) redirect(start.href)
    if (access || lessons.length === 0) redirect(coursePage)
    currentLesson = lessons[0]
  }
  const actualLessonId = currentLesson.id

  const currentIndex = lessons.findIndex((l) => l.id === actualLessonId)
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null

  const [otherCourses, completedLessonIds, ratingSummary, userReview, watchProgress] = await Promise.all([
    fetchOtherCourses(courseId),
    getCompletedLessons(courseId),
    getCourseRatingSummary(courseId),
    currentUser ? getUserReview(currentUser.id, courseId) : Promise.resolve(null),
    getCourseWatchProgress(courseId),
  ])

  // Build a map of lessonId -> watch percent
  const watchProgressMap: Record<string, number> = {}
  watchProgress.forEach((wp) => {
    watchProgressMap[wp.lessonId] = wp.percent
  })

  // Remember where the student is so "Continue learning" resumes here.
  // Fire-and-forget: the action swallows its own errors and a failure must
  // never block the lesson from rendering.
  if (currentUser && !currentLesson.locked) {
    void updateLastAccessed(currentUser.id, courseId, actualLessonId)
  }

  const isLessonCompleted = completedLessonIds.includes(actualLessonId)
  // Progress is measured over the published lessons this package opens
  // (docs/go-patches-phase-3.md R3) — the same set `fetchMyEnrollments`'s
  // `openLessons` counts. Staff (no `access`) see progress over every
  // published lesson, same fallback as `fetchMyEnrollments`.
  const openLessonIds = access
    ? await openPublishedLessonIds(access)
    : new Set(lessons.filter((l) => l.isPublished).map((l) => l.id))
  const courseProgressPercent =
    openLessonIds.size > 0
      ? Math.min(100, Math.round((completedLessonIds.filter((id) => openLessonIds.has(id)).length / openLessonIds.size) * 100))
      : 0

  return (
    <div className="flex min-h-svh flex-col lg:h-svh">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-ws-surface flex h-12 md:h-14 items-center justify-between border-b border-ws-hairline px-3 md:px-4 shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* The course page forwards a learner straight back here, so Back
              leaves for their programs; staff return to their preview. */}
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={access ? "/dashboard/my-courses" : coursePage} />}
            className="shrink-0 gap-1.5 text-xs md:text-sm text-ws-muted hover:text-ws-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-4!" />
          <span className="text-xs md:text-sm font-medium truncate text-ws-primary">
            {course.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          {/* About, outcomes, reviews, instructor, bookmark — the program's
              overview, kept one explicit click away from the lessons. */}
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`${coursePage}?view=overview`} aria-label="Program overview" />}
            className="gap-1.5 text-xs md:text-sm text-ws-muted hover:text-ws-primary"
          >
            <InfoIcon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Overview</span>
          </Button>
          <span className="text-[10px] md:text-xs text-ws-muted tabular-nums">
            {currentIndex + 1}/{lessons.length} · {courseProgressPercent}%
          </span>
        </div>
        {/* Course progress — thin brand fill along the header's bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-ws-track">
          <div
            className="h-full bg-ws-brand transition-[width] duration-[var(--ws-motion-fast)]"
            style={{ width: `${courseProgressPercent}%` }}
          />
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:overflow-auto">
          {/* Video / Content Area */}
          <div className="shrink-0">
            {currentLesson.locked ? (
              <div className="w-full border-b border-ws-hairline bg-ws-sunken">
                <div className="mx-auto max-w-xl px-6 py-12 md:py-16">
                  <PackageLockNotice
                    title="This lesson isn't in your package"
                    requiredLabel={currentLesson.requiredPackage ? PACKAGE_LABEL[currentLesson.requiredPackage] : null}
                  />
                </div>
              </div>
            ) : currentLesson.type === "video" && currentLesson.videoUrl ? (
              <LessonVideoPlayer
                src={currentLesson.videoUrl}
                courseId={courseId}
                lessonId={actualLessonId}
                currentTitle={currentLesson.title}
                nextLesson={
                  nextLesson
                    ? {
                        id: nextLesson.id,
                        title: nextLesson.title,
                        duration: nextLesson.duration,
                        type: nextLesson.type,
                      }
                    : null
                }
              />
            ) : currentLesson.type === "text" && currentLesson.content ? (
              <div className="w-full bg-muted/30 border-b">
                <div className="max-w-3xl mx-auto p-6 md:p-8">
                  <RichTextContent content={currentLesson.content} />
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full bg-black flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="h-3 w-3 rounded-full bg-ws-danger animate-pulse mx-auto" />
                  <p className="text-white/60 text-sm">
                    Live Session — Not Started
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Lesson Info */}
          <div className="p-4 md:p-6 space-y-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs capitalize">
                {currentLesson.type}
              </Badge>
              {currentLesson.duration && (
                <span className="text-xs text-muted-foreground">
                  {currentLesson.duration} min
                </span>
              )}
              {!currentLesson.locked && (
                <div className="ml-auto">
                  <MarkCompleteButton
                    courseId={courseId}
                    lessonId={actualLessonId}
                    completed={isLessonCompleted}
                  />
                </div>
              )}
            </div>
            <h1 className="text-lg md:text-xl font-bold">
              {currentLesson.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {currentLesson.description || "Lesson content goes here."}
            </p>

            {/* Navigation */}
            <Separator />
            <div className="flex items-center justify-between gap-3">
              {prevLesson ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-0 max-w-[45%]"
                  render={
                    <Link
                      href={`/dashboard/courses/${courseId}/learn/${prevLesson.id}`}
                    />
                  }
                >
                  <span className="shrink-0">←</span>
                  <span className="truncate">{prevLesson.title}</span>
                </Button>
              ) : (
                <div />
              )}
              {nextLesson ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-0 max-w-[45%]"
                  render={
                    <Link
                      href={`/dashboard/courses/${courseId}/learn/${nextLesson.id}`}
                    />
                  }
                >
                  <span className="truncate">{nextLesson.title}</span>
                  <span className="shrink-0">→</span>
                </Button>
              ) : (
                <FinishCourseButton
                  courseId={courseId}
                  pendingLessonId={!currentLesson.locked && !isLessonCompleted ? actualLessonId : null}
                />
              )}
            </div>

            {/* Mobile Course Content (lesson list) */}
            <div className="lg:hidden">
              <Separator />
              <div className="mt-4">
                <h3 className="font-semibold text-sm mb-3">Program content</h3>
                <MobileLessonList
                  lessons={lessons}
                  courseId={courseId}
                  currentLessonId={actualLessonId}
                  nextLessonId={nextLesson?.id ?? null}
                  completedLessonIds={completedLessonIds}
                  watchProgressMap={watchProgressMap}
                />
              </div>
            </div>

            {/* Knowledge check for this lesson (renders only when one exists) */}
            {!currentLesson.locked && <LessonQuizCard courseId={courseId} lessonId={actualLessonId} />}

            {/* The program's final exam (renders only when one exists) — the
                course page, which learners no longer stop on, was its door. */}
            {access && <CourseExamCard courseId={courseId} />}

            {/* Downloadable materials for this lesson + the course */}
            <Separator />
            <CourseResources courseId={courseId} lessonId={actualLessonId} />

            {/* Instructor & Course Interaction */}
            <Separator />
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              {/* Instructor */}
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  {course.instructorAvatarUrl && (
                    <AvatarImage
                      src={course.instructorAvatarUrl}
                      alt={course.instructorName}
                    />
                  )}
                  <AvatarFallback>
                    {course.instructorName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">
                    {course.instructorName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Course Instructor
                  </p>
                </div>
                {course.entitlements.instructorQa ? (
                  <MessageInstructorButton instructorId={course.instructorId} />
                ) : (
                  <p className="max-w-40 text-right text-[11px] leading-snug text-ws-muted">
                    Instructor Q&amp;A isn&apos;t in your package
                  </p>
                )}
              </div>
              
              {/* Rating */}
              <div className="pt-2 border-t">
                <CourseRating
                  courseId={courseId}
                  courseTitle={course.title}
                  currentRating={ratingSummary?.average}
                  ratingCount={ratingSummary?.count}
                  review={userReview}
                  inline
                />
              </div>
            </div>

            {/* Discover more courses */}
            {otherCourses.length > 0 && (
              <>
                <Separator />
                <CourseCarousel
                  courses={otherCourses}
                  title="Discover More Courses"
                />
              </>
            )}
          </div>
        </div>

        {/* Lesson Sidebar — desktop only */}
        <LessonSidebar
          lessons={lessons}
          courseId={courseId}
          currentLessonId={actualLessonId}
          nextLessonId={nextLesson?.id ?? null}
          completedLessonIds={completedLessonIds}
          watchProgressMap={watchProgressMap}
        />
      </div>
    </div>
  )
}
