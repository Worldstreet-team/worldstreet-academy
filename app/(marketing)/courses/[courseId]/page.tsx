import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { levelChipStyle } from "@/components/shared/level-badge"
import { fetchPublicCourse } from "@/lib/actions/student"
import { checkEnrollment } from "@/lib/actions/enrollments"
import { CourseSchedulingCta } from "@/components/shared/course-scheduling-cta"
import { courseAvailability } from "@/lib/types/course"
import { getCurrentUser } from "@/lib/auth"
import { CourseOutcomes } from "@/components/courses/course-outcomes"
import { WishlistButton } from "@/components/marketing/wishlist-button"
import { StarIcon } from "lucide-react"

// Per-visitor: enrollment state and the coming-soon/live cutover both change
// under a cached render.
export const revalidate = 0

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const course = await fetchPublicCourse(courseId)
  if (!course) notFound()

  // Check enrollment for authenticated users
  const currentUser = await getCurrentUser().catch(() => null)
  const enrollment = currentUser
    ? await checkEnrollment(currentUser.id, courseId)
    : null
  const isEnrolled = enrollment?.isEnrolled ?? false
  const isPreEnrolled = enrollment?.status === "pre_enrolled"

  const isComingSoon =
    courseAvailability({ status: "published", availableAt: course.availableAt }) ===
    "coming_soon"

  // Fall back to the course home when there is nothing to resume into, rather
  // than linking at a lesson id that does not exist.
  const resumeLessonId = enrollment?.resumeLessonId ?? course.lessons[0]?.id ?? null

  return (
    <div className="container mx-auto px-4 py-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thumbnail */}
          <div className="aspect-video w-full rounded-lg bg-ws-raised relative overflow-hidden">
            {course.thumbnailUrl ? (
              <Image
                src={course.thumbnailUrl}
                alt={course.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 66vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-ws-muted">Course Thumbnail</span>
              </div>
            )}
          </div>

          {/* Title & Meta */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize" style={levelChipStyle(course.level)}>
                {course.level}
              </Badge>
              {course.pricing === "free" ? (
                <Badge>Free</Badge>
              ) : (
                <Badge variant="outline">${course.price}</Badge>
              )}
              {course.rating && (
                <span className="inline-flex items-center gap-1 text-sm">
                  <StarIcon
                    size={14}
                    className="text-ws-rating"
                    fill="currentColor" />
                  <span className="font-medium text-ws-primary">{course.rating}</span>
                  <span className="text-ws-muted">/ 5</span>
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-ws-primary">
              {course.title}
            </h1>
            <p className="text-ws-muted leading-relaxed">{course.description}</p>
          </div>

          {/* What you'll learn · requirements · audience — renders nothing
              when every list is empty */}
          <CourseOutcomes
            whatYouWillLearn={course.whatYouWillLearn}
            requirements={course.requirements}
            targetAudience={course.targetAudience}
          />
        </div>

        {/* Sidebar — Course Info */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-lg border border-ws-hairline bg-ws-surface p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-3xl font-semibold tabular-nums tracking-[-0.02em] text-ws-primary">
                {course.pricing === "free" ? "Free" : `$${course.price}`}
              </p>
              <span className="rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
                {course.pricing === "free" ? "Full access" : "One-time purchase"}
              </span>
            </div>

            <div className="mt-6 border-t border-ws-hairline pt-6">
              {isComingSoon || isPreEnrolled ? (
                <CourseSchedulingCta
                  courseId={course.id}
                  availableAt={course.availableAt}
                  isComingSoon={isComingSoon}
                  preEnrollEnabled={course.preEnrollEnabled}
                  isPreEnrolled={isPreEnrolled}
                  isPaid={course.pricing === "paid"}
                  price={course.price}
                  signedIn={Boolean(currentUser)}
                />
              ) : isEnrolled ? (
                <Link
                  href={
                    resumeLessonId
                      ? `/dashboard/courses/${course.id}/learn/${resumeLessonId}`
                      : `/dashboard/courses/${course.id}`
                  }
                  className="flex h-11 w-full items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
                >
                  Continue Learning
                </Link>
              ) : (
                <>
                  <WishlistButton
                    courseId={course.id}
                    signedIn={Boolean(currentUser)}
                    variant="full"
                  />
                  {currentUser && (
                    <p className="mt-3 text-center text-[11px] text-ws-muted">
                      Saved courses live in your{" "}
                      <Link
                        href="/dashboard/bookmarks"
                        className="font-medium text-ws-gold hover:underline"
                      >
                        wishlist
                      </Link>
                      .
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
