import { notFound } from "next/navigation"
import { fetchCourseForEdit } from "@/lib/actions/instructor"
import { CourseEditor } from "@/components/instructor/course-editor"

/**
 * Admin course editing. fetchCourseForEdit is ownership-scoped for
 * instructors but admin-wide for ADMIN roles, so any course resolves here.
 */
export default async function AdminEditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const data = await fetchCourseForEdit(courseId)
  if (!data) notFound()

  const lessons = data.lessons.map((l) => ({
    id: l.id,
    courseId,
    title: l.title,
    description: l.description,
    type: l.type as "video" | "live" | "text",
    videoUrl: l.videoUrl,
    thumbnailUrl: l.thumbnailUrl,
    content: l.content,
    duration: l.duration,
    order: 0, // not used by the editor form
    isFree: l.isFree,
  }))

  return (
    <CourseEditor
      adminMode
      returnTo="/admin/courses"
      course={data.course}
      existingLessons={lessons}
    />
  )
}
