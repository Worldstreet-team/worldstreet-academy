export type CourseLevel = "beginner" | "intermediate" | "advanced"
export type CoursePricing = "free" | "paid"
export type CourseStatus = "draft" | "published" | "suspended" | "closed" | "archived"
export type CourseCategory = "Cryptocurrency" | "Trading" | "DeFi" | "NFTs" | "Development" | "Blockchain" | "Other"

/**
 * What a customer can DO with a course right now — derived, never stored.
 * "coming_soon" flips to "live" the instant availableAt passes, with no cron:
 * every reader computes it from the same two fields.
 */
export type CourseAvailability =
  | "draft"
  | "coming_soon"
  | "live"
  | "suspended"
  | "closed"
  | "archived"

export function courseAvailability(
  course: { status: CourseStatus; availableAt: string | Date | null },
  now: Date = new Date(),
): CourseAvailability {
  if (course.status !== "published") return course.status
  if (!course.availableAt) return "live"
  return new Date(course.availableAt) > now ? "coming_soon" : "live"
}

/** Customer-facing label for an availability state (admin sees raw statuses). */
export const AVAILABILITY_LABEL: Record<CourseAvailability, string> = {
  draft: "Draft",
  coming_soon: "Coming Soon",
  live: "Live",
  suspended: "Temporarily Unavailable",
  closed: "Closed",
  archived: "Archived",
}

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
  availableAt: string | null
  preEnrollEnabled: boolean
  category?: CourseCategory
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
  type: "video" | "live" | "text"
  videoUrl: string | null
  thumbnailUrl: string | null
  content: string | null
  duration: number | null // in seconds
  order: number
  isFree: boolean
}
