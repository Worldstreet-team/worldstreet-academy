import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { levelChipStyle } from "@/components/shared/level-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { fetchPublicCourse } from "@/lib/actions/student"
import { checkEnrollment } from "@/lib/actions/enrollments"
import { getCurrentUser } from "@/lib/auth"
import { CourseOutcomes } from "@/components/courses/course-outcomes"
import { CourseReviews } from "@/components/courses/course-reviews"
import { QueryProvider } from "@/components/providers/query-provider"
import { BookOpenIcon, ClockIcon, LockIcon, PlayIcon, StarIcon, UsersIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

// Force dynamic rendering to show fresh instructor avatars
export const revalidate = 0

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const course = await fetchPublicCourse(courseId)
  if (!course) notFound()

  const totalHours = Math.floor(course.totalDuration / 60)
  const totalMins = course.totalDuration % 60
  const durationLabel = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`
  const firstLessonId = course.lessons[0]?.id ?? "none"

  // Check enrollment for authenticated users
  const currentUser = await getCurrentUser().catch(() => null)
  const enrollment = currentUser
    ? await checkEnrollment(currentUser.id, courseId)
    : null
  const isEnrolled = enrollment?.isEnrolled ?? false

  const stats = [
    { icon: BookOpenIcon, value: String(course.totalLessons), label: "Lessons" },
    { icon: ClockIcon, value: durationLabel, label: "Duration" },
    {
      icon: UsersIcon,
      value: course.enrolledCount.toLocaleString(),
      label: "Students",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8 pb-24 md:pb-12">
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
            <div className="flex items-center gap-3 text-sm text-ws-muted">
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  {course.instructorAvatarUrl && (
                    <AvatarImage src={course.instructorAvatarUrl} alt={course.instructorName} />
                  )}
                  <AvatarFallback>
                    {course.instructorName.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <span>{course.instructorName}</span>
              </div>
              <span>·</span>
              <span>{course.totalLessons} lessons</span>
              <span>·</span>
              <span>{durationLabel}</span>
              <span>·</span>
              <span>{course.enrolledCount.toLocaleString()} students</span>
            </div>
          </div>

          {/* What you'll learn · requirements · audience */}
          <CourseOutcomes
            whatYouWillLearn={course.whatYouWillLearn}
            requirements={course.requirements}
            targetAudience={course.targetAudience}
          />

          {/* Reviews — read-only for guests; the marketing layout has no
              QueryProvider, so mount one around the client component */}
          <QueryProvider>
            <CourseReviews
              courseId={course.id}
              readOnly
              signInHref={`/dashboard/courses/${course.id}`}
            />
          </QueryProvider>

          {/* Curriculum */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">
              Curriculum{" "}
              <span className="text-ws-muted font-sans font-normal text-sm">
                ({course.lessons.length} lessons)
              </span>
            </h2>
            {course.lessons.length > 0 ? (
              <div className="rounded-lg border border-ws-hairline bg-ws-surface divide-y divide-ws-hairline overflow-hidden">
                {course.lessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-ws-raised"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ws-raised text-xs font-medium tabular-nums text-ws-muted">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ws-primary">
                          {lesson.title}
                        </p>
                        <p className="text-xs text-ws-muted">
                          {lesson.type === "video"
                            ? `Video · ${lesson.duration || 0}min`
                            : lesson.type === "live"
                              ? "Live Session"
                              : `Reading · ${lesson.duration || 0}min`}
                        </p>
                      </div>
                    </div>
                    {lesson.isFree ? (
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-ws-gold">
                        <PlayIcon  size={14} fill="currentColor" />
                        Preview
                      </span>
                    ) : (
                      <LockIcon
                        
                        size={14}
                        className="shrink-0 text-ws-subtle" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ws-muted">
                Curriculum details coming soon.
              </p>
            )}
          </div>
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

            {/* Key stats */}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ws-hairline pt-5">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-2.5 rounded-sm border border-ws-hairline p-3"
                >
                  <RenderIcon icon={stat.icon}
                    
                    size={16}
                    className="shrink-0 text-ws-gold" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold tabular-nums text-ws-primary">
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-ws-muted">{stat.label}</p>
                  </div>
                </div>
              ))}
              {course.rating && (
                <div className="flex items-center gap-2.5 rounded-sm border border-ws-hairline p-3">
                  <StarIcon
                    
                    size={16}
                    className="shrink-0 text-ws-rating"
                    fill="currentColor" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold tabular-nums text-ws-primary">
                      {course.rating} / 5
                    </p>
                    <p className="text-[11px] text-ws-muted">Rating</p>
                  </div>
                </div>
              )}
            </div>

            {/* Details list */}
            <div className="mt-5 space-y-3 border-t border-ws-hairline pt-5 text-sm">
              <div className="flex justify-between">
                <span className="text-ws-muted">Level</span>
                <span className="capitalize font-medium text-ws-primary">{course.level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ws-muted">Price</span>
                <span className="font-medium tabular-nums text-ws-primary">
                  {course.pricing === "free" ? "Free" : `$${course.price}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ws-muted">Instructor</span>
                <span className="font-medium text-ws-primary">{course.instructorName}</span>
              </div>
            </div>

            <div className="mt-6">
              {isEnrolled ? (
                <Link
                  href={`/dashboard/courses/${course.id}/learn/${enrollment?.resumeLessonId ?? firstLessonId}`}
                  className="flex h-11 w-full items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
                >
                  Continue Learning
                </Link>
              ) : (
                <Link
                  href={`/dashboard/checkout?courseId=${course.id}`}
                  className="flex h-11 w-full items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
                >
                  Enroll Now
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
