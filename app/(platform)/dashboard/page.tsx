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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"
import { EmptyState } from "@/components/shared/empty-state"
import { 
  fetchMyEnrollments, 
  fetchMyBookmarks, 
  fetchBrowseCourses,
  toggleCourseBookmark,
  type StudentEnrollment,
  type StudentBookmark,
  type BrowseCourse,
} from "@/lib/actions/student"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  StarIcon,
  Bookmark01Icon,
  Search01Icon,
  Tick02Icon,
  Certificate01Icon,
} from "@hugeicons/core-free-icons"
import { useUser } from "@/components/providers/user-provider"

// Skeleton loader for course cards
function CourseCardSkeleton() {
  return (
    <Card className="h-full">
      <Skeleton className="aspect-video w-full" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const user = useUser()
  const [courseSearch, setCourseSearch] = React.useState("")
  const [enrollments, setEnrollments] = React.useState<StudentEnrollment[]>([])
  const [bookmarks, setBookmarks] = React.useState<StudentBookmark[]>([])
  const [browseCourses, setBrowseCourses] = React.useState<BrowseCourse[]>([])
  const [bookmarkedIds, setBookmarkedIds] = React.useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = React.useState(true)

  // Fetch data on mount
  React.useEffect(() => {
    async function loadData() {
      try {
        const [enrollmentsData, bookmarksData, browseData] = await Promise.all([
          fetchMyEnrollments(),
          fetchMyBookmarks(),
          fetchBrowseCourses(),
        ])
        setEnrollments(enrollmentsData)
        setBookmarks(bookmarksData)
        setBrowseCourses(browseData)
        setBookmarkedIds(new Set(bookmarksData.map((b) => b.courseId)))
      } catch (error) {
        console.error("Failed to load dashboard data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleToggleBookmark = async (courseId: string) => {
    // Optimistic update
    setBookmarkedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(courseId)) {
        newSet.delete(courseId)
      } else {
        newSet.add(courseId)
      }
      return newSet
    })
    
    const result = await toggleCourseBookmark(courseId)
    if (result.success) {
      // Refresh bookmarks list
      const updatedBookmarks = await fetchMyBookmarks()
      setBookmarks(updatedBookmarks)
      setBookmarkedIds(new Set(updatedBookmarks.map((b) => b.courseId)))
    }
  }

  const filteredEnrolled = React.useMemo(() => {
    if (!courseSearch.trim()) return enrollments
    const q = courseSearch.toLowerCase()
    return enrollments.filter(
      (e) =>
        e.courseTitle.toLowerCase().includes(q) ||
        e.instructorName.toLowerCase().includes(q)
    )
  }, [courseSearch, enrollments])

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-8 pb-24 md:pb-8">
        {/* Welcome Section */}
        <div>
          <div className="flex items-center justify-between gap-4">
            <div className="px-1 flex-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                Hello, {user.firstName}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Continue your learning journey.
              </p>
              <div className="w-12 h-px bg-border my-3" />
              <div className="mt-4">
                <p className="text-2xl md:text-3xl font-bold">${user.walletBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
          {enrollments.length > 0 && (
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

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {[1, 2, 3].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredEnrolled.length === 0 && courseSearch.trim() ? (
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
            <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
              <CarouselContent className="-ml-3">
                {filteredEnrolled.map((enrollment) => (
                  <CarouselItem
                    key={enrollment.id}
                    className="pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3 2xl:basis-1/4"
                  >
                    <Link
                      href={`/dashboard/courses/${enrollment.courseId}/learn/${enrollment.firstLessonId ?? "first"}`}
                      className="group block"
                    >
                      <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
                        <div className="aspect-video w-full bg-muted relative overflow-hidden">
                          {enrollment.courseThumbnail ? (
                            <Image
                              src={enrollment.courseThumbnail}
                              alt={enrollment.courseTitle}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 640px) 85vw, (max-width: 1024px) 50vw, 33vw"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-muted-foreground/40 text-xs">No thumbnail</span>
                            </div>
                          )}
                          {/* Bookmark button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleToggleBookmark(enrollment.courseId)
                            }}
                            className={`absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 backdrop-blur-md shadow-lg transition-all hover:bg-white/40 dark:border-white/20 ${
                              bookmarkedIds.has(enrollment.courseId)
                                ? "bg-primary/80 text-white"
                                : "bg-white/20 text-white dark:bg-black/30"
                            }`}
                          >
                            <HugeiconsIcon
                              icon={Bookmark01Icon}
                              size={14}
                              fill={bookmarkedIds.has(enrollment.courseId) ? "currentColor" : "none"}
                            />
                          </button>
                          {enrollment.progress === 100 && (
                            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 text-[10px] bg-emerald-500/90 text-white rounded-full px-2 py-1 border-0">
                              <HugeiconsIcon icon={Tick02Icon} size={12} />
                              <span>Completed</span>
                            </div>
                          )}
                        </div>

                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0 space-y-2">
                              <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {enrollment.courseTitle}
                              </h3>
                              <div className="flex items-center gap-2">
                                <Avatar size="sm">
                                  {enrollment.instructorAvatarUrl && (
                                    <AvatarImage
                                      src={enrollment.instructorAvatarUrl}
                                      alt={enrollment.instructorName}
                                    />
                                  )}
                                  <AvatarFallback>
                                    {enrollment.instructorName
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground truncate">
                                  {enrollment.instructorName}
                                </span>
                              </div>
                            </div>
                            <RadialProgress
                              value={enrollment.progress}
                              size={52}
                              strokeWidth={4}
                              className="shrink-0"
                            />
                          </div>

                          <div className="mt-3 pt-2.5 border-t flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-primary group-hover:underline">
                              {enrollment.progress === 100
                                ? "Review course"
                                : enrollment.progress > 0
                                  ? "Continue learning"
                                  : "Start course"}{" "}
                              →
                            </span>
                            {enrollment.progress === 100 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={(e) => {
                                  e.preventDefault()
                                  window.location.href = `/dashboard/courses/${enrollment.courseId}/certificate`
                                }}
                              >
                                <HugeiconsIcon icon={Certificate01Icon} size={12} />
                                Certificate
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>

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

        {/* Browse Courses Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Browse Courses</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Discover new courses to learn
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {[1, 2, 3].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : browseCourses.length === 0 ? (
            <EmptyState
              illustration="/user/dashboard/course-empty-state.png"
              title="No courses available"
              description="There are no published courses yet. Check back soon!"
            />
          ) : (
            <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
              <CarouselContent className="-ml-3">
                {browseCourses.slice(0, 8).map((course) => (
                  <CarouselItem
                    key={course.id}
                    className="pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3 2xl:basis-1/4"
                  >
                    <Link
                      href={`/courses/${course.id}`}
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
                              <span className="text-muted-foreground/40 text-xs">No thumbnail</span>
                            </div>
                          )}
                          {/* Price badge */}
                          <Badge className="absolute top-2.5 left-2.5 text-[10px] z-10 border border-white/30 shadow-lg backdrop-blur-md bg-white/20 text-white dark:bg-black/30 dark:border-white/20">
                            {course.pricing === "free" ? "Free" : `$${course.price}`}
                          </Badge>
                          {/* Bookmark button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleToggleBookmark(course.id)
                            }}
                            className={`absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 backdrop-blur-md shadow-lg transition-all hover:bg-white/40 dark:border-white/20 ${
                              bookmarkedIds.has(course.id)
                                ? "bg-primary/80 text-white"
                                : "bg-white/20 text-white dark:bg-black/30"
                            }`}
                          >
                            <HugeiconsIcon
                              icon={Bookmark01Icon}
                              size={14}
                              fill={bookmarkedIds.has(course.id) ? "currentColor" : "none"}
                            />
                          </button>
                        </div>

                        <CardContent className="p-4 space-y-2">
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
                            <span className="text-xs text-muted-foreground truncate">
                              {course.instructorName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {course.level}
                            </Badge>
                            {course.rating && (
                              <div className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5">
                                <HugeiconsIcon icon={StarIcon} size={11} className="text-orange-500" fill="currentColor" />
                                <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400">
                                  {course.rating}
                                </span>
                              </div>
                            )}
                            {course.enrolledCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {course.enrolledCount} enrolled
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>

              <div className="flex items-center justify-between mt-5">
                <Button
                  variant="default"
                  size="sm"
                  render={<Link href="/dashboard/courses" />}
                >
                  Browse all courses
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

        {/* Bookmarks Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Bookmarks</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Courses you&apos;ve bookmarked
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {[1, 2, 3].map((i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : bookmarks.length === 0 ? (
            <EmptyState
              illustration="/user/dashboard/course-empty-state.png"
              title="No bookmarks yet"
              description="Browse courses and bookmark the ones you like to find them here."
              actionLabel="Browse Courses"
              actionHref="/dashboard/courses"
              actionVariant="outline"
            />
          ) : (
            <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
              <CarouselContent className="-ml-3">
                {bookmarks.map((bookmark) => (
                  <CarouselItem
                    key={bookmark.id}
                    className="pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3 2xl:basis-1/4"
                  >
                    <Link
                      href={`/courses/${bookmark.courseId}`}
                      className="group block"
                    >
                      <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
                        <div className="aspect-video w-full bg-muted relative overflow-hidden">
                          {bookmark.courseThumbnail ? (
                            <Image
                              src={bookmark.courseThumbnail}
                              alt={bookmark.courseTitle}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 640px) 85vw, (max-width: 1024px) 50vw, 33vw"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-muted-foreground/40 text-xs">No thumbnail</span>
                            </div>
                          )}
                          {/* Price badge */}
                          <Badge className="absolute top-2.5 left-2.5 text-[10px] z-10 border border-white/30 shadow-lg backdrop-blur-md bg-white/20 text-white dark:bg-black/30 dark:border-white/20">
                            {bookmark.pricing === "free" ? "Free" : `$${bookmark.price}`}
                          </Badge>
                          {/* Bookmark button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleToggleBookmark(bookmark.courseId)
                            }}
                            className="absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-primary/80 text-white backdrop-blur-md shadow-lg transition-all hover:bg-primary"
                          >
                            <HugeiconsIcon icon={Bookmark01Icon} size={14} fill="currentColor" />
                          </button>
                        </div>

                        <CardContent className="p-4 space-y-2">
                          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                            {bookmark.courseTitle}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              {bookmark.instructorAvatarUrl && (
                                <AvatarImage
                                  src={bookmark.instructorAvatarUrl}
                                  alt={bookmark.instructorName}
                                />
                              )}
                              <AvatarFallback>
                                {bookmark.instructorName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground truncate">
                              {bookmark.instructorName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {bookmark.level}
                            </Badge>
                            {bookmark.rating && (
                              <div className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5">
                                <HugeiconsIcon icon={StarIcon} size={11} className="text-orange-500" fill="currentColor" />
                                <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400">
                                  {bookmark.rating}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>

              <div className="flex items-center justify-between mt-5">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/dashboard/bookmarks" />}
                >
                  View all bookmarks
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
      </div>
    </>
  )
}
