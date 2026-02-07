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
} from "@/components/ui/carousel"
import { mockCourses } from "@/lib/mock-data"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  UserMultipleIcon,
  DollarCircleIcon,
  StarIcon,
  Add01Icon,
  BarChartIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

const INSTRUCTOR_ID = "inst-1"

/* ── Reusable grid course card ────────────────────────────── */
function CourseCard({
  course,
  badge,
}: {
  course: (typeof mockCourses)[number]
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
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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

export default function InstructorDashboard() {
  const [courseSearch, setCourseSearch] = React.useState("")
  const myCourses = mockCourses.filter((c) => c.instructorId === INSTRUCTOR_ID)
  const totalStudents = myCourses.reduce((s, c) => s + c.enrolledCount, 0)
  const totalRevenue = myCourses.reduce(
    (s, c) => s + (c.pricing === "paid" ? (c.price ?? 0) * c.enrolledCount * 0.85 : 0),
    0
  )
  const ratedCourses = myCourses.filter((c) => c.rating != null)
  const avgRating =
    ratedCourses.length > 0
      ? (ratedCourses.reduce((s, c) => s + (c.rating ?? 0), 0) / ratedCourses.length).toFixed(1)
      : "—"

  const stats = [
    { label: "Total Courses", value: myCourses.length, icon: BookOpen01Icon },
    { label: "Total Students", value: totalStudents.toLocaleString(), icon: UserMultipleIcon },
    {
      label: "Revenue (est.)",
      value: `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: DollarCircleIcon,
    },
    { label: "Avg. Rating", value: avgRating, icon: StarIcon, iconColor: "text-orange-500" },
  ]

  const sections = React.useMemo(() => {
    const q = courseSearch.toLowerCase()
    const filtered = courseSearch.trim()
      ? myCourses.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.status.toLowerCase().includes(q)
        )
      : myCourses

    return [
      { key: "draft", title: "Drafts", courses: filtered.filter((c) => c.status === "draft"), badge: { label: "Draft", variant: "secondary" as const } },
      { key: "published", title: "Published", courses: filtered.filter((c) => c.status === "published"), badge: { label: "Published", variant: "default" as const } },
      { key: "archived", title: "Archived", courses: filtered.filter((c) => c.status === "archived"), badge: { label: "Archived", variant: "outline" as const } },
    ].filter((s) => s.courses.length > 0)
  }, [myCourses, courseSearch])

  return (
    <>
      <Topbar title="Instructor Dashboard" variant="instructor" />
      <div className="p-4 md:p-6 space-y-8 pb-24 md:pb-8">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Welcome back, Sarah</h1>
            <p className="text-sm text-muted-foreground">
              Here&apos;s an overview of your teaching activity.
            </p>
          </div>
          <Button render={<Link href="/instructor/courses/new" />} className="hidden md:inline-flex">
            <HugeiconsIcon icon={Add01Icon} size={16} />
            New Course
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <HugeiconsIcon
                      icon={stat.icon}
                      size={18}
                      className={("iconColor" in stat && stat.iconColor) ? stat.iconColor : "text-primary"}
                      {...(stat.icon === StarIcon ? { fill: "currentColor" } : {})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Course search */}
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

        {/* Course Sections — Carousel on mobile, Grid on desktop */}
        {sections.length === 0 && courseSearch.trim() ? (
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
          sections.map((section, idx) => (
            <section key={section.key}>
              {idx > 0 && <Separator className="mb-8" />}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm">{section.title}</h2>
                  <Badge variant="secondary" className="text-[10px]">{section.courses.length}</Badge>
                </div>
                <Button variant="ghost" size="sm" render={<Link href="/instructor/courses" />}>
                  View all
                </Button>
              </div>

              {/* Mobile: Carousel */}
              <div className="md:hidden">
                <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                  <CarouselContent className="-ml-3">
                    {section.courses.map((course) => (
                      <CarouselItem key={course.id} className="pl-3 basis-[85%] sm:basis-1/2">
                        <CourseCard course={course} badge={section.badge} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              </div>

              {/* Desktop: Grid */}
              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.courses.map((course) => (
                  <CourseCard key={course.id} course={course} badge={section.badge} />
                ))}
              </div>
            </section>
          ))
        )}

        {/* Quick Actions */}
        <Separator />
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link href="/instructor/courses/new">
              <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <HugeiconsIcon icon={Add01Icon} size={18} className="shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Create Course</p>
                    <p className="text-[11px] text-muted-foreground">Add a new course</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/instructor/courses">
              <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <HugeiconsIcon icon={BookOpen01Icon} size={18} className="shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Manage Courses</p>
                    <p className="text-[11px] text-muted-foreground">Edit & publish</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/instructor/analytics">
              <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <HugeiconsIcon icon={BarChartIcon} size={18} className="shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Analytics</p>
                    <p className="text-[11px] text-muted-foreground">View performance</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
