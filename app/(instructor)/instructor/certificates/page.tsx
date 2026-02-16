"use client"

import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Topbar } from "@/components/platform/topbar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Certificate01Icon,
  StarIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from "@tanstack/react-query"
import { fetchInstructorCertificateStats } from "@/lib/actions/certificates"

export default function InstructorCertificatesPage() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["instructor", "certificates"],
    queryFn: () => fetchInstructorCertificateStats(),
  })

  const totalCerts = stats.reduce((s, c) => s + c.totalCertificates, 0)
  const ratedCourses = stats.filter((c) => c.ratingCount > 0)
  const avgRating =
    ratedCourses.length > 0
      ? (ratedCourses.reduce((s, c) => s + c.ratingAverage, 0) / ratedCourses.length).toFixed(1)
      : "—"

  return (
    <>
      <Topbar title="Certificates & Ratings" variant="instructor" />
      <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold">Certificates & Ratings</h1>
          <p className="text-sm text-muted-foreground">
            See how many students earned certificates and how they rate your courses.
          </p>
        </div>

        {/* Overview stats */}
        {!isLoading && stats.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Certificates</p>
                    <p className="text-xl font-bold">{totalCerts}</p>
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
                    <p className="text-xs text-muted-foreground">Avg. Rating</p>
                    <p className="text-xl font-bold">{avgRating}</p>
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
                    <p className="text-xs text-muted-foreground">Courses</p>
                    <p className="text-xl font-bold">{stats.length}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <HugeiconsIcon icon={UserMultipleIcon} size={18} className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Course list */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <CardContent className="p-3.5 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HugeiconsIcon icon={Certificate01Icon} size={48} className="text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No courses yet</h3>
            <p className="text-sm text-muted-foreground">
              Once students complete your courses, their certificates and ratings will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((course) => (
              <Link
                key={course.courseId}
                href={`/instructor/courses/${course.courseId}`}
                className="group"
              >
                <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
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
                        <span className="text-muted-foreground/40 text-xs">No thumbnail</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {course.courseTitle}
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={Certificate01Icon} size={14} className="text-primary" />
                        <span>
                          <span className="font-semibold text-foreground">{course.totalCertificates}</span>{" "}
                          {course.totalCertificates === 1 ? "certificate" : "certificates"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <HugeiconsIcon icon={StarIcon} size={14} className="text-orange-500" fill="currentColor" />
                        <span>
                          {course.ratingCount > 0 ? (
                            <>
                              <span className="font-semibold text-foreground">{course.ratingAverage.toFixed(1)}</span>
                              <span className="text-muted-foreground"> ({course.ratingCount})</span>
                            </>
                          ) : (
                            "No ratings"
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Rating bar */}
                    {course.ratingCount > 0 && (
                      <div className="flex items-center gap-0.5 pt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <HugeiconsIcon
                            key={star}
                            icon={StarIcon}
                            size={12}
                            className={star <= Math.round(course.ratingAverage) ? "text-orange-500" : "text-muted-foreground/20"}
                            fill={star <= Math.round(course.ratingAverage) ? "currentColor" : "none"}
                          />
                        ))}
                      </div>
                    )}
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
