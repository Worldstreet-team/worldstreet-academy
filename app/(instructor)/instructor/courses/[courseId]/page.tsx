import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { levelChipStyle } from "@/components/shared/level-badge"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCourses } from "@/components/shared/illustrations"
import { ArrowLeft, FileQuestion, Pencil } from "lucide-react"
import { fetchCourseForEdit } from "@/lib/actions/instructor"
import { ResourceManager } from "@/components/instructor/resource-manager"
import { DeleteCourseButton } from "@/components/instructor/delete-course-dialog"

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

  const statusChip = {
    draft: { label: "Draft", className: "bg-ws-chip text-ws-muted" },
    published: { label: "Published", className: "bg-ws-success/15 text-ws-success" },
    suspended: { label: "Suspended", className: "bg-ws-warning/15 text-ws-warning" },
    closed: { label: "Closed", className: "bg-ws-raised text-ws-subtle" },
    archived: { label: "Archived", className: "bg-ws-raised text-ws-subtle" },
  }[course.status]

  return (
    <>
      <Topbar
        title="Course Info"
        variant="instructor"
        breadcrumbOverrides={{ [courseId]: course.title }}
      />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          {/* Back + edit */}
          <div className="flex items-center justify-between">
            <Link
              href="/instructor/courses"
              className="inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Back to Courses
            </Link>
            <Button
              render={<Link href={`/instructor/courses/${course.id}/edit`} />}
              className="bg-ws-brand text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:bg-ws-brand hover:opacity-90"
            >
              <Pencil size={16} strokeWidth={2} />
              Edit Course
            </Button>
          </div>

          {/* Hero — large thumbnail */}
          <div className="relative aspect-[21/9] w-full overflow-hidden rounded-lg bg-ws-raised">
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
                <span className="text-ws-subtle">Course Thumbnail</span>
              </div>
            )}
          </div>

          {/* Title + badges */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusChip.className}`}
              >
                {statusChip.label}
              </span>
              <span
                className="rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]"
                style={levelChipStyle(course.level)}
              >
                {course.level}
              </span>
              <span className="rounded-full bg-ws-chip px-2.5 py-0.5 text-xs font-semibold tabular-nums text-ws-gold">
                {course.pricing === "free" ? "Free" : `$${course.price}`}
              </span>
            </div>
            <PageHeader
              title={course.title}
              subline={`${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"} · ${durationLabel}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main content */}
            <div className="space-y-6 lg:col-span-2">
              {/* Description */}
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-ws-primary">About this course</h2>
                <p className="text-sm leading-relaxed text-ws-muted">
                  {course.description}
                </p>
              </div>

              <div className="h-px bg-ws-hairline" />

              {/* Curriculum */}
              <div>
                <h2 className="mb-4 text-base font-semibold text-ws-primary">
                  Curriculum
                  <span className="ml-2 text-sm font-normal text-ws-muted">
                    {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
                  </span>
                </h2>
                {lessons.length > 0 ? (
                  <div className="space-y-2">
                    {lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between rounded-md border border-ws-hairline bg-ws-surface p-3 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ws-raised text-xs font-medium tabular-nums text-ws-muted">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-ws-primary">{lesson.title}</p>
                            <p className="text-[11px] tabular-nums text-ws-muted">
                              {lesson.type === "video"
                                ? `Video · ${lesson.duration ? `${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, '0')}` : '--:--'}`
                                : lesson.type === "live"
                                  ? "Live Session"
                                  : `Reading · ${lesson.duration ? `${Math.floor(lesson.duration / 60)}:${String(lesson.duration % 60).padStart(2, '0')}` : '--:--'}`}
                            </p>
                          </div>
                        </div>
                        {lesson.isFree && (
                          <span className="rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-medium text-ws-muted">
                            Free Preview
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-ws-hairline bg-ws-surface">
                    <EmptyState
                      art={<ArtCourses />}
                      title="No lessons yet"
                      description="Build your curriculum by adding the first lesson."
                      actionLabel="Add Lessons"
                      actionHref={`/instructor/courses/${course.id}/lessons`}
                    />
                  </div>
                )}
              </div>

              <div className="h-px bg-ws-hairline" />

              {/* Downloadable materials */}
              <ResourceManager courseId={course.id} />
            </div>

            {/* Sidebar — stats & actions */}
            <div className="lg:col-span-1">
              <div className="space-y-5 rounded-lg border border-ws-hairline bg-ws-surface p-5">
                {/* Quick stats */}
                <div className="flex items-center justify-around text-center">
                  <div>
                    <p className="font-display text-2xl font-semibold tabular-nums text-ws-primary">
                      {lessons.length}
                    </p>
                    <p className="text-[11px] text-ws-muted">Lessons</p>
                  </div>
                  <div className="h-10 w-px bg-ws-hairline" />
                  <div>
                    <p className="font-display text-2xl font-semibold tabular-nums text-ws-primary">
                      {durationLabel}
                    </p>
                    <p className="text-[11px] text-ws-muted">Duration</p>
                  </div>
                </div>

                <div className="h-px bg-ws-hairline" />

                {/* Course details */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ws-muted">Level</span>
                    <span className="font-medium capitalize text-ws-primary">{course.level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ws-muted">Price</span>
                    <span className="font-medium tabular-nums text-ws-primary">
                      {course.pricing === "free" ? "Free" : `$${course.price}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ws-muted">Status</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusChip.className}`}
                    >
                      {course.status}
                    </span>
                  </div>
                  {course.category && (
                    <div className="flex justify-between">
                      <span className="text-ws-muted">Category</span>
                      <span className="font-medium text-ws-primary">{course.category}</span>
                    </div>
                  )}
                </div>

                <div className="h-px bg-ws-hairline" />

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    className="w-full bg-ws-brand text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:bg-ws-brand hover:opacity-90"
                    render={<Link href={`/instructor/courses/${course.id}/edit`} />}
                  >
                    <Pencil size={16} strokeWidth={2} />
                    Edit Course
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    render={<Link href={`/instructor/courses/${course.id}/exam`} />}
                  >
                    <FileQuestion size={16} strokeWidth={2} />
                    Exam (CBT)
                  </Button>
                  {/* Type-to-confirm dialog; the deleteCourse action is unchanged */}
                  <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
