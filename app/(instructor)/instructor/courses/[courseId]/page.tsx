import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Topbar } from "@/components/platform/topbar"
import { mockCourses, mockLessons } from "@/lib/mock-data"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Edit01Icon,
  StarIcon,
  BookOpen01Icon,
  Clock01Icon,
  UserMultipleIcon,
  Certificate01Icon,
  ArrowLeft01Icon,
  ViewIcon,
  Delete01Icon,
} from "@hugeicons/core-free-icons"
import { deleteCourse } from "@/lib/actions/instructor"

export default async function InstructorCourseInfoPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const course = mockCourses.find((c) => c.id === courseId)
  if (!course) notFound()

  const lessons = mockLessons.filter((l) => l.courseId === courseId)
  const totalHours = Math.floor(course.totalDuration / 60)
  const totalMins = course.totalDuration % 60
  const durationLabel = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`

  const statusBadge = {
    draft: { label: "Draft", variant: "secondary" as const },
    published: { label: "Published", variant: "default" as const },
    archived: { label: "Archived", variant: "outline" as const },
  }[course.status]

  return (
    <>
      <Topbar title="Course Info" variant="instructor" />
      <div className="p-6 space-y-6">
        {/* Back + Actions Bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" render={<Link href="/instructor/courses" />}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
            Back to Courses
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={`/courses/${course.id}`} target="_blank" />}
            >
              <HugeiconsIcon icon={ViewIcon} size={14} />
              Public Preview
            </Button>
            <Button render={<Link href={`/instructor/courses/${course.id}/edit`} />}>
              <HugeiconsIcon icon={Edit01Icon} size={16} />
              Edit Course
            </Button>
          </div>
        </div>

        {/* Hero — Large Thumbnail */}
        <div className="aspect-[21/9] w-full rounded-xl bg-muted relative overflow-hidden">
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
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-6 pt-16">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={statusBadge.variant} className="text-xs shadow-sm">
                {statusBadge.label}
              </Badge>
              <Badge variant="secondary" className="capitalize text-xs shadow-sm">
                {course.level}
              </Badge>
              {course.pricing === "free" ? (
                <Badge className="text-xs shadow-sm">Free</Badge>
              ) : (
                <Badge variant="outline" className="text-xs shadow-sm bg-white/10 border-white/20 text-white">
                  ${course.price}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">{course.title}</h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <h2 className="font-semibold text-base">About this course</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {course.description}
              </p>
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-3">
              <Avatar>
                {course.instructorAvatarUrl && (
                  <AvatarImage src={course.instructorAvatarUrl} alt={course.instructorName} />
                )}
                <AvatarFallback>
                  {course.instructorName.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{course.instructorName}</p>
                <p className="text-xs text-muted-foreground">Instructor</p>
              </div>
            </div>

            <Separator />

            {/* Curriculum */}
            <div>
              <h2 className="font-semibold text-base mb-4">
                Curriculum
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  {lessons.length > 0 ? `${lessons.length} lessons` : `${course.totalLessons} lessons`}
                </span>
              </h2>
              {lessons.length > 0 ? (
                <div className="space-y-2">
                  {lessons.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{lesson.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {lesson.type === "video"
                              ? `Video · ${lesson.duration}min`
                              : lesson.type === "live"
                                ? "Live Session"
                                : `Reading · ${lesson.duration}min`}
                          </p>
                        </div>
                      </div>
                      {lesson.isFree && (
                        <Badge variant="secondary" className="text-[10px]">
                          Free Preview
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No lessons added yet.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    render={<Link href={`/instructor/courses/${course.id}/lessons`} />}
                  >
                    Add Lessons
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — Stats & Details */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-sm">Course Stats</h3>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <span className="text-muted-foreground">Certificate</span>
                    <span className="font-medium inline-flex items-center gap-1">
                      <HugeiconsIcon icon={Certificate01Icon} size={14} className="text-primary" />
                      Included
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={statusBadge.variant} className="text-[10px] capitalize">
                      {course.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {new Date(course.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium">
                      {new Date(course.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <Button
                  className="w-full"
                  render={<Link href={`/instructor/courses/${course.id}/edit`} />}
                >
                  <HugeiconsIcon icon={Edit01Icon} size={16} />
                  Edit Course
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  render={<Link href={`/instructor/courses/${course.id}/lessons`} />}
                >
                  <HugeiconsIcon icon={BookOpen01Icon} size={16} />
                  Manage Lessons
                </Button>
                <form action={deleteCourse} className="w-full">
                  <input type="hidden" name="courseId" value={course.id} />
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive"
                    type="submit"
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={16} />
                    Delete Course
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
