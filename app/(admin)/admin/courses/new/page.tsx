import { CourseEditor } from "@/components/instructor/course-editor"

/**
 * Admin course creation — the same editor instructors use, in admin mode
 * (full status set, returns to the admin catalogue). The course is owned by
 * the admin who creates it; there are no live instructors yet, which is why
 * course management lives here at all.
 */
export default function AdminNewCoursePage() {
  return <CourseEditor adminMode returnTo="/admin/courses" />
}
