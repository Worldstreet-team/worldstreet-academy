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
  fetchInstructorProfile,
  fetchInstructorPublicCourses,
  fetchEnrolledCoursesFromInstructor,
} from "@/lib/actions/student"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  StarIcon,
  BookOpen01Icon,
  UserMultipleIcon,
  ArrowLeft01Icon,
  Calendar01Icon,
  LinkSquare01Icon,
} from "@hugeicons/core-free-icons"

// Force dynamic rendering to show fresh instructor avatars
export const revalidate = 0

export default async function InstructorProfilePage({
  params,
}: {
  params: Promise<{ instructorId: string }>
}) {
  const { instructorId } = await params

  const [instructor, courses, enrolledCourses] = await Promise.all([
    fetchInstructorProfile(instructorId),
    fetchInstructorPublicCourses(instructorId),
    fetchEnrolledCoursesFromInstructor(instructorId).catch(() => []),
  ])

  if (!instructor) notFound()

  const memberSince = new Date(instructor.createdAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
    }
  )

  const initials = instructor.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <>
      <Topbar 
        title="Instructor Profile"
        breadcrumbOverrides={{ 
          [instructorId]: instructor.fullName,
          instructor: "Instructors"
        }}
      />
      <div className="flex-1 pb-24 md:pb-8">
        {/* Header */}
        <div className="relative bg-gradient-to-b from-primary/10 to-background pt-4 pb-8 px-4 md:px-6 lg:px-8">
          {/* Back button */}
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href="/dashboard/courses" />}
            className="absolute top-3 left-3 md:left-6"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </Button>

          <div className="flex flex-col items-center text-center pt-8 space-y-4">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              {instructor.avatarUrl && (
                <AvatarImage
                  src={instructor.avatarUrl}
                  alt={instructor.fullName}
                />
              )}
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold">{instructor.fullName}</h1>
              {instructor.headline && (
                <p className="text-muted-foreground">{instructor.headline}</p>
              )}
            </div>

            {/* Stats */}
            {(instructor.totalCourses > 0 || instructor.totalStudents > 0) && (
              <div className="flex items-center gap-6 text-sm">
                {instructor.totalCourses > 0 && (
                  <div className="flex items-center gap-1.5">
                    <HugeiconsIcon
                      icon={BookOpen01Icon}
                      size={16}
                      className="text-primary"
                    />
                    <span className="font-semibold">{instructor.totalCourses}</span>
                    <span className="text-muted-foreground">
                      {instructor.totalCourses === 1 ? 'Course' : 'Courses'}
                    </span>
                  </div>
                )}
                {instructor.totalStudents > 0 && (
                  <div className="flex items-center gap-1.5">
                    <HugeiconsIcon
                      icon={UserMultipleIcon}
                      size={16}
                      className="text-primary"
                    />
                    <span className="font-semibold">
                      {instructor.totalStudents.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      {instructor.totalStudents === 1 ? 'Student' : 'Students'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Expertise Tags */}
            {instructor.expertise.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {instructor.expertise.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
          {/* Bio */}
          {instructor.bio && (
            <div className="space-y-2">
              <h2 className="text-base font-semibold">About</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {instructor.bio}
              </p>
            </div>
          )}

          {/* Member since & Social Links */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon icon={Calendar01Icon} size={14} />
              <span>Member since {memberSince}</span>
            </div>

            {instructor.socialLinks.website && (
              <a
                href={instructor.socialLinks.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <HugeiconsIcon icon={LinkSquare01Icon} size={14} />
                <span>Website</span>
              </a>
            )}

            {instructor.socialLinks.twitter && (
              <a
                href={`https://twitter.com/${instructor.socialLinks.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <span>@{instructor.socialLinks.twitter}</span>
              </a>
            )}

            {instructor.socialLinks.linkedin && (
              <a
                href={instructor.socialLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <span>LinkedIn</span>
              </a>
            )}
          </div>

          <Separator />

          {/* Enrolled courses from this instructor */}
          {enrolledCourses.length > 0 && (
            <>
              <div className="space-y-4">
                <h2 className="text-base font-semibold">
                  Your enrolled courses
                  <span className="text-muted-foreground font-normal text-sm ml-2">
                    ({enrolledCourses.length})
                  </span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {enrolledCourses.map((course) => (
                    <CourseCard key={course.id} course={course} enrolled />
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* All Courses */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold">
              All courses
              <span className="text-muted-foreground font-normal text-sm ml-2">
                ({courses.length})
              </span>
            </h2>
            {courses.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {courses.map((course) => {
                  const isEnrolled = enrolledCourses.some(
                    (ec) => ec.id === course.id
                  )
                  return (
                    <CourseCard
                      key={course.id}
                      course={course}
                      enrolled={isEnrolled}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No courses published yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function CourseCard({
  course,
  enrolled = false,
}: {
  course: {
    id: string
    title: string
    thumbnailUrl: string | null
    level: string
    pricing: "free" | "paid"
    price: number | null
    totalLessons: number
    enrolledCount: number
    rating: number | null
  }
  enrolled?: boolean
}) {
  return (
    <Link href={`/dashboard/courses/${course.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <HugeiconsIcon
                icon={BookOpen01Icon}
                size={32}
                className="text-muted-foreground"
              />
            </div>
          )}

          {/* Enrolled badge */}
          {enrolled && (
            <Badge className="absolute top-2 left-2 text-[10px] bg-green-500 hover:bg-green-500">
              Enrolled
            </Badge>
          )}

          {/* Price badge */}
          <Badge
            variant={course.pricing === "free" ? "secondary" : "default"}
            className="absolute top-2 right-2 text-[10px]"
          >
            {course.pricing === "free" ? "Free" : `$${course.price}`}
          </Badge>
        </div>

        <CardContent className="p-3 space-y-2">
          <h3 className="font-semibold text-sm line-clamp-2">{course.title}</h3>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="capitalize">{course.level}</span>
              <span>·</span>
              <span>{course.totalLessons} lessons</span>
            </div>

            {course.rating && (
              <div className="flex items-center gap-1">
                <HugeiconsIcon
                  icon={StarIcon}
                  size={12}
                  className="text-orange-400"
                  fill="currentColor"
                />
                <span>{course.rating}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <HugeiconsIcon icon={UserMultipleIcon} size={12} />
            <span>{course.enrolledCount.toLocaleString()} students</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
