"use client"

import * as React from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Topbar } from "@/components/platform/topbar"
import { Skeleton } from "@/components/ui/skeleton"
import { useInstructorCourses } from "@/lib/hooks/queries"
import { EmptyState } from "@/components/shared/empty-state"
import { useQuery } from "@tanstack/react-query"
import { fetchInstructorCertificateStats } from "@/lib/actions/certificates"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  StarIcon,
  Certificate01Icon,
  UserMultipleIcon,
  AnalyticsUpIcon,
} from "@hugeicons/core-free-icons"

export default function AnalyticsPage() {
  const { data: courses = [], isLoading } = useInstructorCourses()
  const { data: certStats = [], isLoading: isLoadingStats } = useQuery({
    queryKey: ["instructor", "certificates"],
    queryFn: () => fetchInstructorCertificateStats(),
  })

  // Compute overall stats
  const totalStudents = courses.reduce((s, c) => s + c.enrolledCount, 0)
  const totalCertificates = certStats.reduce((s, c) => s + c.totalCertificates, 0)
  const ratedCourses = certStats.filter((c) => c.ratingCount > 0)
  const avgRating =
    ratedCourses.length > 0
      ? ratedCourses.reduce((s, c) => s + c.ratingAverage * c.ratingCount, 0) /
        ratedCourses.reduce((s, c) => s + c.ratingCount, 0)
      : 0
  const totalRevenue = courses.reduce((s, c) => {
    if (c.pricing === "paid") return s + (c.price ?? 0) * c.enrolledCount * 0.85
    return s
  }, 0)

  // Create a map of cert stats by courseId for quick lookup
  const certStatsMap = React.useMemo(() => {
    const map = new Map<string, (typeof certStats)[0]>()
    certStats.forEach((cs) => map.set(cs.courseId, cs))
    return map
  }, [certStats])

  const isAnyLoading = isLoading || isLoadingStats

  return (
    <>
      <Topbar title="Analytics" variant="instructor" />
      <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-8">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Track your course performance, ratings, and student engagement.
          </p>
        </div>

        {/* Overview Stats */}
        {isAnyLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-6 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : courses.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Students</p>
                    <p className="text-xl font-bold">{totalStudents}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <HugeiconsIcon icon={UserMultipleIcon} size={18} className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Avg. Rating</p>
                    <p className="text-xl font-bold">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                    <HugeiconsIcon icon={StarIcon} size={18} className="text-orange-500" fill="currentColor" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Certificates</p>
                    <p className="text-xl font-bold">{totalCertificates}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <HugeiconsIcon icon={Certificate01Icon} size={18} className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-xl font-bold">
                      {totalRevenue > 0
                        ? `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : "—"}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                    <HugeiconsIcon icon={AnalyticsUpIcon} size={18} className="text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Per-Course Cards with thumbnails and ratings */}
        {isAnyLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            illustration="/user/dashboard/course-empty-state.png"
            title="No courses yet"
            description="Create your first course to see analytics here."
            actionLabel="Create Course"
            actionHref="/instructor/courses/new"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => {
              const stats = certStatsMap.get(course.id)
              const ratingAvg = stats?.ratingAverage ?? 0
              const ratingCount = stats?.ratingCount ?? 0
              const certificates = stats?.totalCertificates ?? 0

              return (
                <Card key={course.id} className="overflow-hidden">
                  {/* Course Thumbnail */}
                  <div className="aspect-video w-full bg-muted relative overflow-hidden">
                    {course.thumbnailUrl ? (
                      <Image
                        src={course.thumbnailUrl}
                        alt={course.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-muted-foreground/40 text-xs">No thumbnail</span>
                      </div>
                    )}
                    {/* Status badge */}
                    <span className="absolute top-2 right-2 rounded-full bg-black/70 text-white text-[10px] px-2 py-0.5 capitalize">
                      {course.status}
                    </span>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                      {course.title}
                    </h3>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold">{course.enrolledCount}</p>
                        <p className="text-[11px] text-muted-foreground">Students</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{certificates}</p>
                        <p className="text-[11px] text-muted-foreground">Certificates</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">
                          {course.pricing === "paid"
                            ? `$${((course.price ?? 0) * course.enrolledCount * 0.85).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            : "Free"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Revenue</p>
                      </div>
                    </div>

                    {/* Rating display */}
                    <div className="flex items-center justify-between pt-1 border-t">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <HugeiconsIcon
                            key={star}
                            icon={StarIcon}
                            size={14}
                            className={star <= Math.round(ratingAvg) ? "text-orange-500" : "text-muted-foreground/20"}
                            fill={star <= Math.round(ratingAvg) ? "currentColor" : "none"}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {ratingCount > 0 ? (
                          <>
                            <span className="font-semibold text-foreground">{ratingAvg.toFixed(1)}</span>
                            {" "}({ratingCount} {ratingCount === 1 ? "review" : "reviews"})
                          </>
                        ) : (
                          "No ratings yet"
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
