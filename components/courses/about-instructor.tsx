import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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

  return (
    <div className="space-y-6">
      {/* Instructor Info */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">About the Instructor</h2>

        {/* Header with Avatar and Name */}
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="border-2 border-primary/20">
            {instructorAvatarUrl && (
              <AvatarImage src={instructorAvatarUrl} alt={instructorName} />
            )}
            <AvatarFallback className="text-sm bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{instructorName}</h3>
              <HugeiconsIcon
                icon={CheckmarkBadge01Icon}
                size={16}
                className="text-primary shrink-0"
              />
            </div>
            {instructorHeadline && (
              <p className="text-sm text-muted-foreground truncate">
                {instructorHeadline}
              </p>
            )}
          </div>
        </div>

        {/* Stats Row - Single Line with Icons */}
        <div className="flex items-center gap-4 py-3 px-4 bg-muted/40 rounded-lg">
          <div className="flex items-center gap-1.5">
            <HugeiconsIcon
              icon={BookOpen01Icon}
              size={14}
              className="text-primary"
            />
            <span className="text-sm font-medium">{totalCourses}</span>
            <span className="text-xs text-muted-foreground">Courses</span>
          </div>
          
          {totalStudents && totalStudents > 0 && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon
                  icon={UserMultiple02Icon}
                  size={14}
                  className="text-primary"
                />
                <span className="text-sm font-medium">
                  {totalStudents.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">Students</span>
              </div>
            </>
          )}
          
          {averageRating && averageRating > 0 && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon
                  icon={StarIcon}
                  size={14}
                  className="text-orange-400"
                  fill="currentColor"
                />
                <span className="text-sm font-medium">{averageRating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">Rating</span>
              </div>
            </>
          )}
        </div>

        {/* Bio */}
        {instructorBio && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
            {instructorBio}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto gap-1.5"
          render={<Link href={`/dashboard/instructor/${instructorId}`} />}
        >
          View Full Profile
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
        </Button>
      </div>

      {/* Courses enrolled from this instructor */}
      {enrolledCourses.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Your courses from {instructorName.split(" ")[0]}
            </h3>
            <div className="grid gap-3">
              {enrolledCourses.slice(0, 3).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
            {enrolledCourses.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                render={<Link href={`/dashboard/instructor/${instructorId}`} />}
              >
                View all {enrolledCourses.length} enrolled courses
              </Button>
            )}
          </div>
        </>
      )}

      {/* Other courses by this instructor */}
      {otherCourses.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              More courses by {instructorName.split(" ")[0]}
            </h3>
            <div className="grid gap-3">
              {otherCourses.slice(0, 3).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
            {otherCourses.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                render={<Link href={`/dashboard/instructor/${instructorId}`} />}
              >
                View all {otherCourses.length} courses
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CourseCard({ course }: { course: InstructorCourse }) {
  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative w-16 h-10 shrink-0 rounded-md bg-muted overflow-hidden">
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={course.title}
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <HugeiconsIcon
              icon={BookOpen01Icon}
              size={16}
              className="text-muted-foreground"
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{course.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground capitalize">
            {course.level}
          </span>
          <span className="text-[11px] text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground">
            {course.totalLessons} lessons
          </span>
          {course.rating && (
            <>
              <span className="text-[11px] text-muted-foreground">·</span>
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

      {/* Price badge */}
      <Badge
        variant={course.pricing === "free" ? "secondary" : "outline"}
        className="text-[10px] shrink-0"
      >
        {course.pricing === "free" ? "Free" : `$${course.price}`}
      </Badge>
    </Link>
  )
}
