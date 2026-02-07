"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadialProgress } from "@/components/ui/radial-progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"
import { EmptyState } from "@/components/shared/empty-state"
import { mockCourses } from "@/lib/mock-data"
import { useFavorites } from "@/lib/hooks/use-favorites"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  Clock01Icon,
  CheckmarkCircle01Icon,
  ArrowRight01Icon,
  StarIcon,
  Bookmark01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

const enrolledCourses = mockCourses.slice(0, 4).map((course, i) => ({
  ...course,
  progress: [35, 72, 100, 12][i],
  lastLessonId: "l-1",
}))

const stats = [
  {
    label: "Enrolled",
    value: enrolledCourses.length,
    icon: BookOpen01Icon,
  },
  {
    label: "In Progress",
    value: enrolledCourses.filter((c) => c.progress > 0 && c.progress < 100).length,
    icon: Clock01Icon,
  },
  {
    label: "Completed",
    value: enrolledCourses.filter((c) => c.progress === 100).length,
    icon: CheckmarkCircle01Icon,
  },
]

export default function DashboardPage() {
  const [courseSearch, setCourseSearch] = React.useState("")
  const { favorites, toggleFavorite, isFavorite } = useFavorites()

  const favoriteCourses = React.useMemo(
    () => mockCourses.filter((c) => favorites.includes(c.id)),
    [favorites]
  )

  const filteredEnrolled = React.useMemo(() => {
    if (!courseSearch.trim()) return enrolledCourses
    const q = courseSearch.toLowerCase()
    return enrolledCourses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.instructorName.toLowerCase().includes(q)
    )
  }, [courseSearch])

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-8 pb-24 md:pb-8">
        {/* Welcome Section — transparent container */}
        <div>
          <div className="flex items-center justify-between gap-4">
            <div className="px-1 flex-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                Hello, Johnson
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Continue your learning journey.
              </p>
              <div className="w-12 h-px bg-border my-3" />
              <div className="mt-4">
                <p className="text-2xl md:text-3xl font-bold">$2,450.00</p>
                <p className="text-xs text-muted-foreground mt-0.5">Wallet Balance</p>
              </div>
            </div>
            <div className="relative w-44 h-44 md:w-56 md:h-56 shrink-0">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              <div className="absolute -inset-8 md:inset-0">
                <Image
                  src="/user/dashboard/dashboard-welcome.png"
                  alt="Welcome"
                  fill
                  className="object-contain relative z-10"
                  sizes="(max-width: 768px) 240px, 224px"
                />
              </div>
            </div>
          </div>
        </div>

        {/* My Courses Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">My Courses</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Continue your learning journey
              </p>
            </div>

          </div>

          {/* Search filter */}
          {enrolledCourses.length > 0 && (
            <div className="relative mb-4">
              <HugeiconsIcon icon={Search01Icon} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Search your courses..."
                className="w-full h-9 rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
          )}

          {filteredEnrolled.length === 0 && courseSearch.trim() ? (
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
          ) : filteredEnrolled.length === 0 ? (
            <EmptyState
              illustration="/user/dashboard/course-empty-state.png"
              title="No courses yet"
              description="You haven't enrolled in any courses. Start exploring today!"
              actionLabel="Browse Courses"
              actionHref="/dashboard/courses"
              actionVariant="outline"
            />
          ) : (
            <Carousel
              opts={{ align: "start", dragFree: true }}
              className="w-full"
            >
              <CarouselContent className="-ml-3">
                {filteredEnrolled.map((course) => (
                  <CarouselItem
                    key={course.id}
                    className="pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3 2xl:basis-1/4"
                  >
                    <Link
                      href={`/dashboard/courses/${course.id}/learn/${course.lastLessonId}`}
                      className="group block"
                    >
                      <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
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
                              <span className="text-muted-foreground/40 text-xs">
                                No thumbnail
                              </span>
                            </div>
                          )}
                          {/* Glassmorphic price badge */}
                          <Badge className="absolute top-2.5 left-2.5 text-[10px] z-10 border border-white/30 shadow-lg backdrop-blur-md bg-white/20 text-white dark:bg-black/30 dark:border-white/20">
                            {course.pricing === "free" ? "Free" : `$${course.price}`}
                          </Badge>
                          {/* Bookmark */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleFavorite(course.id)
                            }}
                            className={`absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 backdrop-blur-md shadow-lg transition-all hover:bg-white/40 dark:border-white/20 ${
                              isFavorite(course.id)
                                ? "bg-primary/80 text-white"
                                : "bg-white/20 text-white dark:bg-black/30"
                            }`}
                          >
                            <HugeiconsIcon
                              icon={Bookmark01Icon}
                              size={14}
                              fill={isFavorite(course.id) ? "currentColor" : "none"}
                            />
                          </button>
                          {course.progress === 100 && (
                            <Badge className="absolute bottom-2.5 left-2.5 text-[10px] bg-emerald-500/90 text-white border-0">
                              Completed
                            </Badge>
                          )}
                        </div>

                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0 space-y-2">
                              <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {course.title}
                              </h3>
                              <div className="flex items-center gap-2">
                                <Avatar size="sm">
                                  {course.instructorAvatarUrl && (
                                    <AvatarImage
                                      src={course.instructorAvatarUrl}
                                      alt={course.instructorName}
                                    />
                                  )}
                                  <AvatarFallback>
                                    {course.instructorName
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-medium text-foreground leading-tight truncate">{course.instructorName}</span>
                                  <span className="text-[10px] text-muted-foreground leading-tight">
                                    {Math.round(
                                      (course.progress / 100) * course.totalLessons
                                    )}
                                    /{course.totalLessons} lessons
                                  </span>
                                </div>
                              </div>
                              {course.rating && (
                                <div className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 w-fit">
                                  <HugeiconsIcon
                                    icon={StarIcon}
                                    size={11}
                                    className="text-orange-500"
                                    fill="currentColor"
                                  />
                                  <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400">{course.rating}</span>
                                </div>
                              )}
                            </div>

                            <RadialProgress
                              value={course.progress}
                              size={52}
                              strokeWidth={4}
                              className="shrink-0"
                            />
                          </div>

                          <div className="mt-3 pt-2.5 border-t">
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
                  </CarouselItem>
                ))}
              </CarouselContent>

              {/* View All + Carousel controls */}
              <div className="flex items-center justify-between mt-5">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/dashboard/my-courses" />}
                >
                  View all courses
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                </Button>
                <div className="flex items-center gap-1">
                  <CarouselPrevious className="static translate-x-0 translate-y-0 h-7 w-7" />
                  <CarouselNext className="static translate-x-0 translate-y-0 h-7 w-7" />
                </div>
              </div>
            </Carousel>
          )}
        </section>

        {/* Favorites Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Favorites</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Courses you&apos;ve bookmarked
              </p>
            </div>
            {favoriteCourses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/dashboard/favorites" />}
              >
                View all
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
              </Button>
            )}
          </div>

          {favoriteCourses.length === 0 ? (
            <EmptyState
              illustration="/user/dashboard/course-empty-state.png"
              title="No favorites yet"
              description="Browse courses and bookmark the ones you like to find them here."
              actionLabel="Browse Courses"
              actionHref="/dashboard/courses"
              actionVariant="outline"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {favoriteCourses.slice(0, 4).map((course) => (
                <Link
                  key={course.id}
                  href={`/dashboard/courses/${course.id}`}
                  className="group block"
                >
                  <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleFavorite(course.id)
                        }}
                        className="absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-primary/80 text-white backdrop-blur-md shadow-lg transition-all hover:bg-primary"
                      >
                        <HugeiconsIcon icon={Bookmark01Icon} size={14} fill="currentColor" />
                      </button>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {course.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          {course.instructorAvatarUrl && (
                            <AvatarImage src={course.instructorAvatarUrl} alt={course.instructorName} />
                          )}
                          <AvatarFallback>{course.instructorName.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground truncate">{course.instructorName}</span>
                      </div>
                      {course.rating && (
                        <div className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 w-fit">
                          <HugeiconsIcon icon={StarIcon} size={11} className="text-orange-500" fill="currentColor" />
                          <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400">{course.rating}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
