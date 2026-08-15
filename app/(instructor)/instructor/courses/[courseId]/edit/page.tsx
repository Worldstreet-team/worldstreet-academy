import { notFound } from "next/navigation"
import { fetchCourseForEdit } from "@/lib/actions/instructor"
import { CourseEditor } from "@/components/instructor/course-editor"

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const data = await fetchCourseForEdit(courseId)
  
  if (!data) notFound()

  // Transform data to match the CourseEditor expected format. Every editable
  // field must pass through here — anything dropped gets wiped on save,
  // because the editor posts the full document back.
  const course = {
    id: data.course.id,
    title: data.course.title,
    description: data.course.description,
    shortDescription: data.course.shortDescription,
    thumbnailUrl: data.course.thumbnailUrl,
    level: data.course.level,
    pricing: data.course.pricing,
    price: data.course.price,
    status: data.course.status,
    category: data.course.category,
    whatYouWillLearn: data.course.whatYouWillLearn,
    availableAt: data.course.availableAt,
    preEnrollEnabled: data.course.preEnrollEnabled,
  }

  const lessons = data.lessons.map((l) => ({
    id: l.id,
    courseId: courseId,
    title: l.title,
    description: l.description,
    type: l.type as "video" | "live" | "text",
    videoUrl: l.videoUrl,
    thumbnailUrl: l.thumbnailUrl,
    content: l.content,
    duration: l.duration,
    order: 0, // Not used in form
    isFree: l.isFree,
  }))

  return <CourseEditor course={course} existingLessons={lessons} />
}
