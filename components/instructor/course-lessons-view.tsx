import { ArrowLeft, Pencil } from "@/components/icons"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import type { fetchCourseLessons } from "@/lib/actions/instructor"
import { LessonManager } from "@/components/instructor/lesson-manager"
import { formatLength } from "@/components/programs/format"

type CourseLessons = NonNullable<Awaited<ReturnType<typeof fetchCourseLessons>>>

/**
 * Manage Lessons — the course's owner, admins and, for a program, the faculty
 * assigned to teach it (fetchCourseLessons). Only an owner or admin also gets
 * "Edit Course" and the lesson quizzes. Rendered by the lessons route, and in
 * place of the course info and editor pages for an assigned tutor — rendered,
 * not redirected to: a redirect() or notFound() from a page in this area
 * crashes the client router ("Rendered more hooks", React #310).
 */
export function CourseLessonsView({ courseId, data }: { courseId: string; data: CourseLessons }) {
  const { course, lessons, canEditCourse } = data

  // Recorded video lengths, as the program page totals them.
  const videoSeconds = lessons.reduce((s, l) => s + (l.type === "video" ? (l.duration ?? 0) : 0), 0)
  const status = course.status === "published" ? "Published" : course.status === "archived" ? "Archived" : "Draft"
  const subline = [
    status,
    `${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"}`,
    videoSeconds > 0 ? `${formatLength(videoSeconds)} of video` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      <Topbar title="Manage Lessons" variant="instructor" breadcrumbOverrides={{ [courseId]: course.title }} />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <div>
            <Link
              href="/instructor/courses"
              className="mb-2 inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Back to Courses
            </Link>
            <PageHeader
              title={course.title}
              subline={subline}
              action={
                canEditCourse ? (
                  <Button variant="outline" render={<Link href={`/instructor/courses/${courseId}/edit`} />}>
                    <Pencil size={14} strokeWidth={2} />
                    Edit Course
                  </Button>
                ) : undefined
              }
            />
          </div>

          <LessonManager courseId={courseId} lessons={lessons} tiers={course.tiers} canQuiz={canEditCourse} />
        </div>
      </div>
    </>
  )
}
