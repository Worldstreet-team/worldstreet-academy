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

  // Transform data to match the CourseEditor expected format
  const course = {
    id: data.course.id,
    title: data.course.title,
    description: data.course.description,
    thumbnailUrl: data.course.thumbnailUrl,
    level: data.course.level as "beginner" | "intermediate" | "advanced",
    pricing: data.course.pricing as "free" | "paid",
    price: data.course.price,
    status: data.course.status as "draft" | "published" | "archived",
    category: data.course.category,
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
