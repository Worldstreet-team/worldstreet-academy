export type EnrollmentStatus = "active" | "completed" | "expired"

export type Enrollment = {
  id: string
  userId: string
  courseId: string
  status: EnrollmentStatus
  enrolledAt: string
  completedAt: string | null
}

export type LessonProgress = {
  id: string
  userId: string
  lessonId: string
  courseId: string
  completed: boolean
  lastPosition: number // seconds for video, scroll % for text
  completedAt: string | null
}

export type CourseProgress = {
  courseId: string
  totalLessons: number
  completedLessons: number
  percentage: number
  lastLessonId: string | null
}
