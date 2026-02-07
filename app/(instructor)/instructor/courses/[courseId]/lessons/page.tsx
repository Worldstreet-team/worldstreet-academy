import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Topbar } from "@/components/platform/topbar"
import { mockCourses, mockLessons } from "@/lib/mock-data"
import { LessonManager } from "@/components/instructor/lesson-manager"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, Edit01Icon } from "@hugeicons/core-free-icons"

export default async function CourseLessonsPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const course = mockCourses.find((c) => c.id === courseId)
  if (!course) notFound()

  const lessons = mockLessons.filter((l) => l.courseId === courseId)

  return (
    <>
      <Topbar title="Manage Lessons" variant="instructor" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/instructor/courses" />}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
            Back
          </Button>
          <Separator orientation="vertical" className="!h-4" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{course.title}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant={
                  course.status === "published" ? "default" : "secondary"
                }
                className="text-[10px] capitalize"
              >
                {course.status}
              </Badge>
              <span>{lessons.length} lessons</span>
              <span>·</span>
              <span>
                {lessons.reduce((s, l) => s + (l.duration ?? 0), 0)} min total
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/instructor/courses/${courseId}/edit`} />}
          >
            <HugeiconsIcon icon={Edit01Icon} size={14} />
            Edit Course
          </Button>
        </div>

        <Separator />

        {/* Lesson Manager */}
        <LessonManager courseId={courseId} lessons={lessons} />
      </div>
    </>
  )
}
