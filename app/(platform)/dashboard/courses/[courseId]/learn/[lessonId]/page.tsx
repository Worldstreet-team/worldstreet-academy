import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { fetchCourseForLearning, fetchOtherCourses, getCompletedLessons } from "@/lib/actions/student"
import { LessonVideoPlayer } from "@/components/learn/lesson-video-player"
import { LessonSidebar } from "@/components/learn/lesson-sidebar"
import { CourseCarousel } from "@/components/learn/course-carousel"
import { MobileLessonList } from "@/components/learn/mobile-lesson-list"
import { CourseRating } from "@/components/learn/course-rating"
import { RichTextContent } from "@/components/ui/rich-text-editor"
import { FinishCourseButton } from "@/components/learn/finish-course-button"

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const { courseId, lessonId } = await params
  const course = await fetchCourseForLearning(courseId)
  if (!course) notFound()

  const lessons = course.lessons
  
  // Find the current lesson - if lessonId doesn't match, use first lesson
  let currentLesson = lessons.find((l) => l.id === lessonId)
  let actualLessonId = lessonId
  
  if (!currentLesson && lessons.length > 0) {
    currentLesson = lessons[0]
    actualLessonId = lessons[0].id
  }
  
  if (!currentLesson) notFound()

  const currentIndex = lessons.findIndex((l) => l.id === actualLessonId)
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null

  const [otherCourses, completedLessonIds] = await Promise.all([
    fetchOtherCourses(courseId),
    getCompletedLessons(courseId),
  ])

  return (
    <div className="flex min-h-svh flex-col lg:h-svh">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-background flex h-12 md:h-14 items-center justify-between border-b px-3 md:px-4 shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/dashboard/courses/${courseId}`} />}
            className="shrink-0 text-xs md:text-sm"
          >
            ← Back
          </Button>
          <Separator orientation="vertical" className="h-4!" />
          <span className="text-xs md:text-sm font-medium truncate">
            {course.title}
          </span>
        </div>
        <span className="text-[10px] md:text-xs text-muted-foreground tabular-nums shrink-0">
          {currentIndex + 1}/{lessons.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:overflow-auto">
          {/* Video / Content Area */}
          <div className="shrink-0">
            {currentLesson.type === "video" && currentLesson.videoUrl ? (
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
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse mx-auto" />
                  <p className="text-white/60 text-sm">
                    Live Session — Not Started
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Lesson Info */}
          <div className="p-4 md:p-6 space-y-4 pb-24 md:pb-6">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs capitalize">
                {currentLesson.type}
              </Badge>
              {currentLesson.duration && (
                <span className="text-xs text-muted-foreground">
                  {currentLesson.duration} min
                </span>
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
                />
              )}
            </div>

            {/* Mobile Course Content (lesson list) */}
            <div className="lg:hidden">
              <Separator />
              <div className="mt-4">
                <h3 className="font-semibold text-sm mb-3">Course Content</h3>
                <MobileLessonList
                  lessons={lessons}
                  courseId={courseId}
                  currentLessonId={actualLessonId}
                  nextLessonId={nextLesson?.id ?? null}
                  completedLessonIds={completedLessonIds}
                />
              </div>
            </div>

            {/* Instructor & Course Interaction */}
            <Separator />
            <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
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
                <Button variant="outline" size="sm">
                  Message
                </Button>
              </div>
              
              {/* Rating */}
              <div className="pt-2 border-t">
                <CourseRating courseId={courseId} currentRating={course.rating ?? undefined} inline />
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
        />
      </div>
    </div>
  )
}
