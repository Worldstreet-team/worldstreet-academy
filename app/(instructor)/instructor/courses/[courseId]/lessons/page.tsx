import { notFound } from "next/navigation"
import { fetchCourseLessons } from "@/lib/actions/instructor"
import { CourseLessonsView } from "@/components/instructor/course-lessons-view"

export default async function CourseLessonsPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const data = await fetchCourseLessons(courseId)

  if (!data) notFound()

  return <CourseLessonsView courseId={courseId} data={data} />
}
