import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { fetchPublicCourse } from "@/lib/actions/student"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  StarIcon,
  BookOpen01Icon,
  Clock01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thumbnail */}
          <div className="aspect-video w-full rounded-lg bg-muted relative overflow-hidden">
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
                <span className="text-muted-foreground">Course Thumbnail</span>
              </div>
            )}
          </div>

          {/* Title & Meta */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize">
                {course.level}
              </Badge>
              {course.pricing === "free" ? (
                <Badge>Free</Badge>
              ) : (
                <Badge variant="outline">${course.price}</Badge>
              )}
              {course.rating && (
                <span className="inline-flex items-center gap-1 text-sm">
                  <HugeiconsIcon
                    icon={StarIcon}
                    size={14}
                    className="text-orange-500"
                    fill="currentColor"
                  />
                  <span className="font-medium">{course.rating}</span>
                  <span className="text-muted-foreground">/ 5</span>
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
            <p className="text-muted-foreground">{course.description}</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
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

          <Separator />

          {/* Curriculum */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Curriculum</h2>
            {course.lessons.length > 0 ? (
              <div className="space-y-2">
                {course.lessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{lesson.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {lesson.type === "video"
                            ? `Video · ${lesson.duration || 0}min`
                            : lesson.type === "live"
                              ? "Live Session"
                              : `Reading · ${lesson.duration || 0}min`}
                        </p>
                      </div>
                    </div>
                    {lesson.isFree && (
                      <Badge variant="secondary" className="text-xs">
                        Preview
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Curriculum details coming soon.
              </p>
            )}
          </div>
        </div>

        {/* Sidebar — Course Info */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <h3 className="font-semibold text-base">Course Information</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Key stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <HugeiconsIcon icon={BookOpen01Icon} size={16} className="text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{course.totalLessons}</p>
                    <p className="text-[11px] text-muted-foreground">Lessons</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <HugeiconsIcon icon={Clock01Icon} size={16} className="text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{durationLabel}</p>
                    <p className="text-[11px] text-muted-foreground">Duration</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <HugeiconsIcon icon={UserMultipleIcon} size={16} className="text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{course.enrolledCount.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">Students</p>
                  </div>
                </div>
                {course.rating && (
                  <div className="flex items-center gap-2.5 rounded-lg border p-3">
                    <HugeiconsIcon icon={StarIcon} size={16} className="text-orange-500 shrink-0" fill="currentColor" />
                    <div>
                      <p className="text-sm font-bold">{course.rating} / 5</p>
                      <p className="text-[11px] text-muted-foreground">Rating</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Details list */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Level</span>
                  <span className="capitalize font-medium">{course.level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">
                    {course.pricing === "free" ? "Free" : `$${course.price}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Instructor</span>
                  <span className="font-medium">{course.instructorName}</span>
                </div>
              </div>

              <Separator />

              <Button className="w-full" size="lg" render={<Link href={`/dashboard/courses/${course.id}/learn/${firstLessonId}`} />}>
                {course.pricing === "free" ? "Start Learning" : "Enroll Now"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
