import { notFound } from "next/navigation"
import { fetchCourseForLearning, markCourseComplete } from "@/lib/actions/student"
import { CourseCompletionClient } from "./completion-client"

export default async function CourseCompletedPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const course = await fetchCourseForLearning(courseId)
  
  if (!course) notFound()

  // Mark course as complete in the database
  await markCourseComplete(courseId)

  return (
    <CourseCompletionClient
      courseTitle={course.title}
      courseId={courseId}
    />
  )
}
