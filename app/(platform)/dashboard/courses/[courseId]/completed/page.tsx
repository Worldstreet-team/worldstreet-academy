import { notFound, redirect } from "next/navigation"
import { fetchCourseForLearning } from "@/lib/actions/student"
import { checkEnrollment } from "@/lib/actions/enrollments"
import { getCurrentUser } from "@/lib/auth"
import { getCourseAccess } from "@/lib/course-access"
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

  // Packages without a certificate (Basic) complete but never certify — don't
  // offer a certificate page that would 404.
  const access = await getCourseAccess(currentUser.id, courseId)
  const hasCertificate = access ? access.entitlements.certificate : true

  return (
    <CourseCompletionClient
      courseTitle={course.title}
      courseId={courseId}
      hasCertificate={hasCertificate}
    />
  )
}
