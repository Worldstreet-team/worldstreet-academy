import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { fetchCourseForEdit } from "@/lib/actions/instructor"
import { LessonManager } from "@/components/instructor/lesson-manager"
import { ArrowLeft, Pencil } from "lucide-react"

export default async function CourseLessonsPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const data = await fetchCourseForEdit(courseId)

  if (!data) notFound()

  const { course, lessons: rawLessons } = data

  // Transform lessons to match expected format
  const lessons = rawLessons.map((l, idx) => ({
    id: l.id,
    courseId: courseId,
    title: l.title,
    description: l.description,
    type: l.type as "video" | "live" | "text",
    videoUrl: l.videoUrl,
    thumbnailUrl: l.thumbnailUrl ?? null,
    content: l.content,
    duration: l.duration,
    order: idx,
    isFree: l.isFree,
  }))

  const totalMinutes = lessons.reduce((s, l) => s + (l.duration ?? 0), 0)

  return (
    <>
      <Topbar
        title="Manage Lessons"
        variant="instructor"
        breadcrumbOverrides={{ [courseId]: course.title }}
      />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <div className="">
            <Link
              href="/instructor/courses"
              className="mb-2 inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Back to Courses
            </Link>
            <PageHeader
              title={course.title}
              subline={`${course.status === "published" ? "Published" : course.status === "archived" ? "Archived" : "Draft"} · ${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"} · ${totalMinutes} min total`}
              action={
                <Button
                  variant="outline"
                  render={<Link href={`/instructor/courses/${courseId}/edit`} />}
                >
                  <Pencil size={14} strokeWidth={2} />
                  Edit Course
                </Button>
              }
            />
          </div>

          {/* Lesson Manager */}
          <LessonManager courseId={courseId} lessons={lessons} />
        </div>
      </div>
    </>
  )
}
