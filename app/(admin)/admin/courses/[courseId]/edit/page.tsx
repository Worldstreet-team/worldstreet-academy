import { notFound } from "next/navigation"
import { fetchCourseForEdit } from "@/lib/actions/instructor"
import { CourseEditor } from "@/components/instructor/course-editor"
import { TeachingFacultyCard } from "@/components/admin/teaching-faculty-card"

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
    minPackageKey: l.minPackageKey,
  }))

  return (
    <>
      <CourseEditor
        adminMode
        returnTo="/admin/courses"
        course={data.course}
        existingLessons={lessons}
      />
      {data.course.kind === "program" && (
        <div className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12">
          <div className="mx-auto w-full max-w-3xl">
            <TeachingFacultyCard courseId={courseId} courseTitle={data.course.title} />
          </div>
        </div>
      )}
    </>
  )
}
