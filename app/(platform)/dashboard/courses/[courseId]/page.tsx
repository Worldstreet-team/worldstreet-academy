import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Topbar } from "@/components/platform/topbar"
import {
  fetchPublicCourse,
  fetchInstructorPublicCourses,
  fetchEnrolledCoursesFromInstructor,
} from "@/lib/actions/student"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  StarIcon,
  BookOpen01Icon,
  Clock01Icon,
  UserMultipleIcon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"
import { LessonPreviewAccordion } from "@/components/courses/lesson-preview-accordion"
import { AboutInstructor } from "@/components/courses/about-instructor"
import { BookmarkButton } from "@/components/courses/bookmark-button"

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
  const durationLabel =
    totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`

  // Get first lesson ID for "Start Learning" button
  const firstLessonId = course.lessons[0]?.id ?? "none"

  // Fetch instructor courses
  const [instructorCourses, enrolledFromInstructor] = await Promise.all([
    fetchInstructorPublicCourses(course.instructorId),
    fetchEnrolledCoursesFromInstructor(course.instructorId).catch(() => []),
  ])

  // Filter out the current course from instructor's courses
  const otherInstructorCourses = instructorCourses.filter(
    (c) => c.id !== course.id
  )

  return (
    <>
      <Topbar 
        title={course.title} 
        breadcrumbOverrides={{ [courseId]: course.title }}
      />
      <div className="flex-1 pb-24 md:pb-8">
        {/* Hero thumbnail — edge-to-edge on mobile */}
        <div className="relative aspect-video md:aspect-[21/9] w-full bg-muted overflow-hidden">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-muted-foreground">Course Thumbnail</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Overlay content */}
          <div className="absolute bottom-0 inset-x-0 p-4 md:p-6 lg:p-8 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="text-[10px] border border-white/30 backdrop-blur-md bg-white/20 text-white dark:bg-black/30 dark:border-white/20">
                {course.pricing === "free" ? "Free" : `$${course.price}`}
              </Badge>
              <Badge className="text-[10px] capitalize border border-white/30 backdrop-blur-md bg-white/20 text-white dark:bg-black/30 dark:border-white/20">
                {course.level}
              </Badge>
              {course.rating && (
                <div className="inline-flex items-center gap-1 rounded-md backdrop-blur-md bg-white/20 border border-white/30 px-1.5 py-0.5">
                  <HugeiconsIcon
                    icon={StarIcon}
                    size={12}
                    className="text-orange-400"
                    fill="currentColor"
                  />
                  <span className="text-[11px] font-medium text-white">
                    {course.rating}
                  </span>
                </div>
              )}
            </div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white leading-tight">
              {course.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <Avatar size="sm" className="border border-white/30">
                {course.instructorAvatarUrl && (
                  <AvatarImage
                    src={course.instructorAvatarUrl}
                    alt={course.instructorName}
                  />
                )}
                <AvatarFallback className="text-[10px]">
                  {course.instructorName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{course.instructorName}</span>
              <span className="text-white/50">·</span>
              <span>{course.enrolledCount.toLocaleString()} students</span>
            </div>
          </div>

          {/* Back button */}
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href="/dashboard/courses" />}
            className="absolute top-3 left-3 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 border border-white/10"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </Button>

          {/* Bookmark */}
          <BookmarkButton courseId={course.id} />
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              {
                icon: BookOpen01Icon,
                value: course.totalLessons,
                label: "Lessons",
              },
              { icon: Clock01Icon, value: durationLabel, label: "Duration" },
              {
                icon: UserMultipleIcon,
                value: course.enrolledCount.toLocaleString(),
                label: "Students",
              },
            ].map((stat) => (
              <Card
                key={stat.label}
                className="border-0 shadow-none bg-muted/40"
              >
                <CardContent className="flex items-center gap-2.5 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <HugeiconsIcon
                      icon={stat.icon}
                      size={16}
                      className="text-primary"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-none">
                      {stat.value}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {stat.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold">About this course</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {course.description}
            </p>
          </div>

          <Separator />

          {/* Curriculum with thumbnails and previews */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold">
              Curriculum{" "}
              <span className="text-muted-foreground font-normal text-sm">
                ({course.lessons.length} lessons)
              </span>
            </h2>
            {course.lessons.length > 0 ? (
              <LessonPreviewAccordion
                lessons={course.lessons}
                courseId={course.id}
                coursePricing={course.pricing}
                coursePrice={course.price}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Curriculum details coming soon.
              </p>
            )}
          </div>

          <Separator />

          {/* About Instructor */}
          <AboutInstructor
            instructorId={course.instructorId}
            instructorName={course.instructorName}
            instructorAvatarUrl={course.instructorAvatarUrl}
            instructorBio={course.instructorBio}
            instructorHeadline={course.instructorHeadline}
            otherCourses={otherInstructorCourses}
            enrolledCourses={enrolledFromInstructor}
            totalStudents={course.instructorTotalStudents}
          />

          {/* CTA */}
          <div className="sticky bottom-20 md:bottom-4 z-30">
            <Button
              className="w-full shadow-lg"
              size="lg"
              render={
                <Link
                  href={`/dashboard/checkout?courseId=${course.id}`}
                />
              }
            >
              Enroll Now
              {course.pricing !== "free" && (
                <span className="ml-1 font-normal opacity-80">
                  · ${course.price}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
