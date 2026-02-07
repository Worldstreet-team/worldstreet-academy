import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { mockCourses, mockLessons } from "@/lib/mock-data"
import { VideoPlayer } from "@/components/learn/video-player"
import { LessonSidebar } from "@/components/learn/lesson-sidebar"
import { CourseCarousel } from "@/components/learn/course-carousel"
import { MobileLessonList } from "@/components/learn/mobile-lesson-list"
import { CourseRating } from "@/components/learn/course-rating"

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const { courseId, lessonId } = await params
  const course = mockCourses.find((c) => c.id === courseId)
  if (!course) notFound()

  const lessons = mockLessons.filter((l) => l.courseId === courseId)
  const currentLesson = lessons.find((l) => l.id === lessonId)
  if (!currentLesson && lessons.length > 0) notFound()

  const currentIndex = lessons.findIndex((l) => l.id === lessonId)
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson =
    currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null

  const otherAuthorCourses = mockCourses.filter((c) => c.id !== courseId)

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
            {currentLesson?.type === "video" && currentLesson.videoUrl ? (
              <VideoPlayer
                src={currentLesson.videoUrl}
                courseId={courseId}
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
            ) : currentLesson?.type === "live" ? (
              <div className="aspect-video w-full bg-black flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse mx-auto" />
                  <p className="text-white/60 text-sm">
                    Live Session — Not Started
                  </p>
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full bg-muted flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Text Lesson</p>
              </div>
            )}
          </div>

          {/* Lesson Info */}
          <div className="p-4 md:p-6 space-y-4 pb-24 md:pb-6">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs capitalize">
                {currentLesson?.type ?? "video"}
              </Badge>
              {currentLesson?.duration && (
                <span className="text-xs text-muted-foreground">
                  {currentLesson.duration} min
                </span>
              )}
            </div>
            <h1 className="text-lg md:text-xl font-bold">
              {currentLesson?.title ?? "Lesson"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {currentLesson?.description ?? "Lesson content goes here."}
            </p>

            {/* Text Content */}
            {currentLesson?.type === "text" && currentLesson.content && (
              <div className="prose prose-sm max-w-none mt-4">
                <p>{currentLesson.content}</p>
              </div>
            )}

            {/* Navigation */}
            <Separator />
            <div className="flex items-center justify-between">
              {prevLesson ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      href={`/dashboard/courses/${courseId}/learn/${prevLesson.id}`}
                    />
                  }
                >
                  ← Previous
                </Button>
              ) : (
                <div />
              )}
              {nextLesson ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      href={`/dashboard/courses/${courseId}/learn/${nextLesson.id}`}
                    />
                  }
                >
                  Next →
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href="/dashboard" />}
                >
                  Finish Course →
                </Button>
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
                  currentLessonId={lessonId}
                  nextLessonId={nextLesson?.id ?? null}
                />
              </div>
            </div>

            {/* Instructor Profile */}
            <Separator />
            <div className="flex items-start gap-3 md:gap-4">
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
                <p className="text-xs text-muted-foreground mt-0.5">
                  {course.instructorId === "inst-1"
                    ? "Crypto educator & DeFi researcher with 8+ years in blockchain."
                    : course.instructorId === "inst-2"
                      ? "Professional trader & technical analyst. Former Wall Street quant."
                      : course.instructorId === "inst-3"
                        ? "Risk management specialist & portfolio strategist."
                        : "Blockchain developer & smart contract auditor."}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span>
                    {
                      mockCourses.filter(
                        (c) => c.instructorId === course.instructorId
                      ).length
                    }{" "}
                    courses
                  </span>
                  <span>·</span>
                  <span>
                    {mockCourses
                      .filter(
                        (c) => c.instructorId === course.instructorId
                      )
                      .reduce((sum, c) => sum + c.enrolledCount, 0)
                      .toLocaleString()}{" "}
                    students
                  </span>
                </div>
              </div>
            </div>

            {/* Rate this course */}
            <CourseRating courseId={courseId} currentRating={course.rating ?? undefined} />

            {/* Discover more courses */}
            {otherAuthorCourses.length > 0 && (
              <>
                <Separator />
                <CourseCarousel
                  courses={otherAuthorCourses}
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
          currentLessonId={lessonId}
          nextLessonId={nextLesson?.id ?? null}
        />
      </div>
    </div>
  )
}
