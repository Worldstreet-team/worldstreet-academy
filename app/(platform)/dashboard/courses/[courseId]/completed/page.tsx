import { notFound, redirect } from "next/navigation"
import { fetchCourseForLearning } from "@/lib/actions/student"
import { checkEnrollment } from "@/lib/actions/enrollments"
import { getCurrentUser } from "@/lib/auth"
import { CourseCompletionClient } from "./completion-client"

/**
 * Read-only celebration page. Completion itself is written by the finish
 * button's server action (or a passing exam attempt) — rendering this page
 * must never mutate state, or a hovered Link prefetch would mark the course
 * complete.
 */
export default async function CourseCompletedPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const course = await fetchCourseForLearning(courseId)

  if (!course) notFound()

  const currentUser = await getCurrentUser()
  if (!currentUser) redirect(`/dashboard/courses/${courseId}`)

  const enrollment = await checkEnrollment(currentUser.id, courseId)
  if (!enrollment.isEnrolled || enrollment.status !== "completed") {
    redirect(`/dashboard/courses/${courseId}`)
  }

  return (
    <CourseCompletionClient
      courseTitle={course.title}
      courseId={courseId}
    />
  )
}
