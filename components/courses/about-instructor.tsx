import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  StarIcon,
  BookOpen01Icon,
  UserMultiple02Icon,
  CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons"
import type { InstructorCourse } from "@/lib/actions/student"

interface AboutInstructorProps {
  instructorId: string
  instructorName: string
  instructorAvatarUrl: string | null
  instructorBio: string | null
  instructorHeadline: string | null
  otherCourses: InstructorCourse[]
  enrolledCourses: InstructorCourse[]
  totalStudents?: number
  averageRating?: number
}

export function AboutInstructor({
  instructorId,
  instructorName,
  instructorAvatarUrl,
  instructorBio,
  instructorHeadline,
  otherCourses,
  enrolledCourses,
  totalStudents,
  averageRating,
}: AboutInstructorProps) {
  const initials = instructorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const totalCourses = otherCourses.length + enrolledCourses.length + 1
  const allCourses = [...enrolledCourses, ...otherCourses]
  
  // Check if there's meaningful content to show
  const hasContent = instructorBio || instructorHeadline || allCourses.length > 0

  // If no content, just show minimal instructor card
  if (!hasContent) {
    return (
      <div className="space-y-5">
        <h2 className="text-base font-semibold">Instructor</h2>
        <div className="rounded-2xl bg-muted/30 p-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 shrink-0 ring-2 ring-background shadow-sm">
              {instructorAvatarUrl && (
                <AvatarImage src={instructorAvatarUrl} alt={instructorName} />
              )}
              <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-[15px]">{instructorName}</h3>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                render={<Link href={`/dashboard/instructor/${instructorId}`} />}
              >
                View profile
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold">About the Instructor</h2>

      {/* Instructor card — soft container, no harsh borders */}
      <div className="rounded-2xl bg-muted/30 p-5 space-y-4">
        {/* Top row: avatar + info + stats */}
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-background shadow-sm">
            {instructorAvatarUrl && (
              <AvatarImage src={instructorAvatarUrl} alt={instructorName} />
            )}
            <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-[15px] truncate">{instructorName}</h3>
              <HugeiconsIcon
                icon={CheckmarkBadge01Icon}
                size={15}
                className="text-primary shrink-0"
              />
            </div>
            {instructorHeadline && (
              <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-1">
                {instructorHeadline}
              </p>
            )}

            {/* Inline stats */}
            {(totalCourses > 0 || (totalStudents != null && totalStudents > 0) || (averageRating != null && averageRating > 0)) && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {totalCourses > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <HugeiconsIcon icon={BookOpen01Icon} size={12} className="text-primary" />
                    <span className="font-medium text-foreground">{totalCourses}</span> {totalCourses === 1 ? 'course' : 'courses'}
                  </span>
                )}
                {totalStudents != null && totalStudents > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <HugeiconsIcon icon={UserMultiple02Icon} size={12} className="text-primary" />
                    <span className="font-medium text-foreground">{totalStudents.toLocaleString()}</span> {totalStudents === 1 ? 'student' : 'students'}
                  </span>
                )}
                {averageRating != null && averageRating > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <HugeiconsIcon icon={StarIcon} size={12} className="text-orange-400" fill="currentColor" />
                    <span className="font-medium text-foreground">{averageRating.toFixed(1)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {instructorBio && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {instructorBio}
          </p>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 -ml-2 text-primary hover:text-primary"
          render={<Link href={`/dashboard/instructor/${instructorId}`} />}
        >
          View full profile
          <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
        </Button>
      </div>

      {/* More courses by this instructor */}
      {allCourses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            More from {instructorName.split(" ")[0]}
          </h3>
          <div className="space-y-1">
            {allCourses.slice(0, 4).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          {allCourses.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              render={<Link href={`/dashboard/instructor/${instructorId}`} />}
            >
              View all {allCourses.length} courses
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function CourseCard({ course }: { course: InstructorCourse }) {
  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="flex items-center gap-3 px-2 py-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors group"
    >
      {/* Thumbnail */}
      <div className="relative w-14 h-9 shrink-0 rounded-lg bg-muted overflow-hidden">
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={course.title}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <HugeiconsIcon
              icon={BookOpen01Icon}
              size={14}
              className="text-muted-foreground/40"
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate group-hover:text-primary transition-colors">
          {course.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {course.totalLessons} lessons
          </span>
          {course.rating && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <div className="flex items-center gap-0.5">
                <HugeiconsIcon
                  icon={StarIcon}
                  size={10}
                  className="text-orange-400"
                  fill="currentColor"
                />
                <span className="text-[11px] text-muted-foreground">
                  {course.rating}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Price */}
      <span className="text-[11px] font-medium text-muted-foreground shrink-0">
        {course.pricing === "free" ? "Free" : `$${course.price}`}
      </span>
    </Link>
  )
}
