import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Topbar } from "@/components/platform/topbar"
import { fetchCourseForEdit } from "@/lib/actions/instructor"
import { LessonManager } from "@/components/instructor/lesson-manager"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, Edit01Icon } from "@hugeicons/core-free-icons"

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
    content: l.content,
    duration: l.duration,
    order: idx,
    isFree: l.isFree,
  }))

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
