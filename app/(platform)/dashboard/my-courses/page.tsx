"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RadialProgress } from "@/components/ui/radial-progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchMyEnrollments, type StudentEnrollment } from "@/lib/actions/student"
import { cn } from "@/lib/utils"

const TABS = ["All", "In Progress", "Completed"] as const
type Tab = (typeof TABS)[number]

export default function MyCoursesPage() {
  const [activeTab, setActiveTab] = React.useState<Tab>("All")
  const [search, setSearch] = React.useState("")
  const [enrolledCourses, setEnrolledCourses] = React.useState<StudentEnrollment[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadEnrollments() {
      try {
        const data = await fetchMyEnrollments()
        setEnrolledCourses(data)
      } catch (error) {
        console.error("Failed to load enrollments:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadEnrollments()
  }, [])

  const filteredCourses = React.useMemo(() => {
    let courses = enrolledCourses

    switch (activeTab) {
      case "In Progress":
        courses = courses.filter((c) => c.progress > 0 && c.progress < 100)
        break
      case "Completed":
        courses = courses.filter((c) => c.progress === 100)
        break
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      courses = courses.filter(
        (c) =>
          c.courseTitle.toLowerCase().includes(q) ||
          c.instructorName.toLowerCase().includes(q)
      )
    }

    return courses
  }, [activeTab, search, enrolledCourses])

  return (
    <>
      <Topbar title="My Courses" />
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 pb-24 md:pb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground mt-1">
            All your enrolled courses in one place.
          </p>
        </div>

        {/* Filter tabs + Search */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {!isLoading && enrolledCourses.length > 0 && (
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your courses..."
                className="w-full h-9 rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-full">
                <Skeleton className="aspect-video w-full" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : enrolledCourses.length === 0 ? (
          <EmptyState
            illustration="/user/dashboard/course-empty-state.png"
            title="No courses yet"
            description="You haven't enrolled in any courses. Start exploring today!"
            actionLabel="Browse Courses"
            actionHref="/dashboard/courses"
            actionVariant="outline"
          />
        ) : filteredCourses.length === 0 && search.trim() ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
            <p>No courses match &quot;{search}&quot;</p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-primary text-xs mt-1 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
            <p>No {activeTab.toLowerCase()} courses</p>
            <button
              type="button"
              onClick={() => setActiveTab("All")}
              className="text-primary text-xs mt-1 hover:underline"
            >
              Show all courses
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filteredCourses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.courseId}/learn/${course.firstLessonId || ""}`}
                className="group block"
              >
                <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
                  {/* Flush thumbnail */}
                  <div className="aspect-video w-full bg-muted relative overflow-hidden">
                    {course.courseThumbnail ? (
                      <Image
                        src={course.courseThumbnail}
                        alt={course.courseTitle}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-muted-foreground/40 text-xs font-medium">
                          {course.courseTitle.split(" ").slice(0, 2).join(" ")}
                        </span>
                      </div>
                    )}
                    {course.progress === 100 && (
                      <Badge className="absolute top-2.5 right-2.5 text-[10px]">
                        Completed
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {course.courseTitle}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar size="sm">
                              <AvatarFallback>{course.instructorName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                            </Avatar>
                            {course.instructorName}
                          </span>
                        </p>
                      </div>

                      <RadialProgress
                        value={course.progress}
                        size={56}
                        strokeWidth={4}
                        className="shrink-0"
                      />
                    </div>

                    <div className="mt-4 pt-3 border-t">
                      <span className="text-xs font-medium text-primary group-hover:underline">
                        {course.progress === 100
                          ? "Review course"
                          : course.progress > 0
                            ? "Continue learning"
                            : "Start course"}{" "}
                        →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
