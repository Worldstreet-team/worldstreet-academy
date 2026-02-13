"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Topbar } from "@/components/platform/topbar"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"
import { type InstructorCourseItem } from "@/lib/actions/instructor"
import { useInstructorCourses } from "@/lib/hooks/queries"
import { InstructorCoursesPageSkeleton } from "@/components/skeletons/course-skeletons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  StarIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

/* ── Grid course card ─────────────────────────────────────── */
function CourseCard({
  course,
  badge,
}: {
  course: InstructorCourseItem
  badge: { label: string; variant: "default" | "secondary" | "outline" }
}) {
  return (
    <Link href={`/instructor/courses/${course.id}`}>
      <Card className="group overflow-hidden hover:shadow-md hover:border-primary/30 transition-all h-full">
        <div className="aspect-video w-full bg-muted relative overflow-hidden">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 85vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-muted-foreground/40 text-xs">No thumbnail</span>
            </div>
          )}
          <Badge className="absolute top-2 left-2 text-[10px] shadow-sm" variant={badge.variant}>
            {badge.label}
          </Badge>
        </div>
        <CardContent className="p-3.5 space-y-1.5">
          <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span>{course.totalLessons} lessons</span>
            <span>·</span>
            <span>{course.enrolledCount.toLocaleString()} students</span>
            <span>·</span>
            <span className="font-medium text-foreground">
              {course.pricing === "free" ? "Free" : `$${course.price}`}
            </span>
            {course.rating && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <HugeiconsIcon icon={StarIcon} size={11} className="text-orange-500" fill="currentColor" />
                  {course.rating}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function InstructorCoursesPage() {
  const [courseSearch, setCourseSearch] = React.useState("")
  const { data: courses = [], isLoading } = useInstructorCourses()

  const totalStudents = courses.reduce((s, c) => s + c.enrolledCount, 0)
  const publishedCount = courses.filter((c) => c.status === "published").length
  const draftCount = courses.filter((c) => c.status === "draft").length
  const archivedCount = courses.filter((c) => c.status === "archived").length

  const filteredCourses = React.useMemo(() => {
    if (!courseSearch.trim()) return courses
    const q = courseSearch.toLowerCase()
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
    )
  }, [courses, courseSearch])

  const sections = React.useMemo(() => {
    return [
      { key: "published", title: "Published", courses: filteredCourses.filter((c) => c.status === "published"), badge: { label: "Published", variant: "default" as const } },
      { key: "draft", title: "Drafts", courses: filteredCourses.filter((c) => c.status === "draft"), badge: { label: "Draft", variant: "secondary" as const } },
      { key: "archived", title: "Archived", courses: filteredCourses.filter((c) => c.status === "archived"), badge: { label: "Archived", variant: "outline" as const } },
    ].filter((s) => s.courses.length > 0)
  }, [filteredCourses])

  return (
    <>
      <Topbar title="My Courses" variant="instructor" />
      <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">My Courses</h1>
            <p className="text-sm text-muted-foreground">
              {courses.length} total · {publishedCount} published · {draftCount} drafts · {archivedCount} archived ·{" "}
              {totalStudents.toLocaleString()} students
            </p>
          </div>
          <Button render={<Link href="/instructor/courses/new" />} className="hidden md:inline-flex">
            <HugeiconsIcon icon={Add01Icon} size={16} />
            New Course
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
            placeholder="Search your courses..."
            className="w-full h-9 rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <InstructorCoursesPageSkeleton />
        ) : courses.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border p-12 text-center space-y-3">
            <p className="text-muted-foreground text-sm">
              You haven&apos;t created any courses yet.
            </p>
            <Button render={<Link href="/instructor/courses/new" />}>
              Create Your First Course
            </Button>
          </div>
        ) : sections.length === 0 && courseSearch.trim() ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
            <p>No courses match &quot;{courseSearch}&quot;</p>
            <button
              type="button"
              onClick={() => setCourseSearch("")}
              className="text-primary text-xs mt-1 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section, idx) => (
              <section key={section.key}>
                {idx > 0 && <Separator className="mb-8" />}
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-semibold">{section.title}</h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {section.courses.length}
                  </Badge>
                </div>

                {/* Carousel for all screen sizes */}
                <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                  <div className="flex items-center justify-end gap-1 -mt-8 mb-3">
                    <CarouselPrevious className="static translate-x-0 translate-y-0 h-7 w-7" />
                    <CarouselNext className="static translate-x-0 translate-y-0 h-7 w-7" />
                  </div>
                  <CarouselContent className="-ml-3">
                    {section.courses.map((course) => (
                      <CarouselItem key={course.id} className="pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3">
                        <CourseCard course={course} badge={section.badge} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
