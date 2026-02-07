import { notFound } from "next/navigation"
import { mockCourses, mockLessons } from "@/lib/mock-data"
import { CourseEditor } from "@/components/instructor/course-editor"

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const course = mockCourses.find((c) => c.id === courseId)
  if (!course) notFound()

  const lessons = mockLessons.filter((l) => l.courseId === courseId)

  return <CourseEditor course={course} existingLessons={lessons} />
}
