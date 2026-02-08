import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Topbar } from "@/components/platform/topbar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Edit01Icon,
  ArrowLeft01Icon,
  Delete01Icon,
} from "@hugeicons/core-free-icons"
import { deleteCourse, fetchCourseForEdit } from "@/lib/actions/instructor"

export default async function InstructorCourseInfoPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const data = await fetchCourseForEdit(courseId)
  
  if (!data) notFound()
  
  const { course, lessons } = data
  
  // Calculate duration from lessons (videoDuration in seconds)
  const totalSeconds = lessons.reduce((sum, l) => sum + (l.duration || 0), 0)
  const totalHours = Math.floor(totalSeconds / 3600)
  const totalMins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  const durationLabel = totalHours > 0 
    ? `${totalHours}h ${totalMins}m` 
    : totalMins > 0 
      ? `${totalMins}m${secs > 0 ? ` ${secs}s` : ""}` 
      : `${secs}s`

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
          <Button render={<Link href={`/instructor/courses/${course.id}/edit`} />}>
            <HugeiconsIcon icon={Edit01Icon} size={16} />
            Edit Course
          </Button>
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
        </div>

        {/* Course Title & Badges */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusBadge.variant} className="text-xs">
              {statusBadge.label}
            </Badge>
            <Badge variant="secondary" className="capitalize text-xs">
              {course.level}
            </Badge>
            {course.pricing === "free" ? (
              <Badge className="text-xs">Free</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                ${course.price}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{course.title}</h1>
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

            <Separator />

            {/* Curriculum */}
            <div>
              <h2 className="font-semibold text-base mb-4">
                Curriculum
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
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
                              ? `Video · ${lesson.duration ? `${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, '0')}` : '--:--'}`
                              : lesson.type === "live"
                                ? "Live Session"
                                : `Reading · ${lesson.duration ? `${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, '0')}` : '--:--'}`}
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

          {/* Sidebar — Stats & Actions */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-5 space-y-5">
                {/* Quick Stats */}
                <div className="flex items-center justify-around text-center">
                  <div>
                    <p className="text-2xl font-bold">{lessons.length}</p>
                    <p className="text-[11px] text-muted-foreground">Lessons</p>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div>
                    <p className="text-2xl font-bold">{durationLabel}</p>
                    <p className="text-[11px] text-muted-foreground">Duration</p>
                  </div>
                </div>

                <Separator />

                {/* Course Details */}
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
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={statusBadge.variant} className="text-[10px] capitalize">
                      {course.status}
                    </Badge>
                  </div>
                  {course.category && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium">{course.category}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    render={<Link href={`/instructor/courses/${course.id}/edit`} />}
                  >
                    <HugeiconsIcon icon={Edit01Icon} size={16} />
                    Edit Course
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
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
