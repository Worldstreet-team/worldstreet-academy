export type CourseLevel = "beginner" | "intermediate" | "advanced"
export type CoursePricing = "free" | "paid"
export type CourseStatus = "draft" | "published" | "archived"

export type Course = {
  id: string
  title: string
  description: string
  thumbnailUrl: string | null
  instructorId: string
  instructorName: string
  instructorAvatarUrl: string | null
  level: CourseLevel
  pricing: CoursePricing
  price: number | null
  currency: string
  status: CourseStatus
  totalLessons: number
  totalDuration: number // in minutes
  enrolledCount: number
  rating: number | null
  createdAt: string
  updatedAt: string
}

export type CourseWithLessons = Course & {
  lessons: Lesson[]
}

export type Lesson = {
  id: string
  courseId: string
  title: string
  description: string | null
  type: "video" | "text" | "live"
  videoUrl: string | null
  content: string | null
  duration: number | null // in minutes
  order: number
  isFree: boolean
}
