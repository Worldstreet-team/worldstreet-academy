"use client"

import * as React from "react"
import Image from "next/image"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCourses } from "@/components/shared/illustrations"
import { Skeleton } from "@/components/ui/skeleton"
import { useInstructorCourses } from "@/lib/hooks/queries"
import { useQuery } from "@tanstack/react-query"
import { fetchInstructorCertificateStats } from "@/lib/actions/certificates"
import { getMyInstructorEarnings } from "@/lib/actions/earnings"
import { Star, Trophy, TrendingUp, Users } from "lucide-react"

export default function AnalyticsPage() {
  const { data: courses = [], isLoading } = useInstructorCourses()
  const { data: certStats = [], isLoading: isLoadingStats } = useQuery({
    queryKey: ["instructor", "certificates"],
    queryFn: () => fetchInstructorCertificateStats(),
  })
  const { data: earnings } = useQuery({
    queryKey: ["instructor", "earnings"],
    queryFn: () => getMyInstructorEarnings(),
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

  // Cert stats by courseId for quick lookup — plain derivation, the React
  // Compiler memoizes this automatically.
  const certStatsMap = new Map<string, (typeof certStats)[0]>(
    certStats.map((cs) => [cs.courseId, cs])
  )

  const isAnyLoading = isLoading || isLoadingStats

  return (
    <>
      <Topbar title="Analytics" variant="instructor" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="Analytics"
            subline="Track your course performance, ratings, and student engagement."
          />

          {/* Overview stats */}
          {isAnyLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[76px] rounded-lg" />
              ))}
            </div>
          ) : courses.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Total Students"
                value={totalStudents.toLocaleString()}
                icon={<Users size={18} strokeWidth={2} />}
              />
              <StatTile
                label="Avg. Rating"
                value={avgRating > 0 ? avgRating.toFixed(1) : "—"}
                context={
                  ratedCourses.length > 0
                    ? `${ratedCourses.reduce((s, c) => s + c.ratingCount, 0)} reviews`
                    : undefined
                }
                icon={<Star size={18} strokeWidth={2} />}
                tone="gold"
              />
              <StatTile
                label="Certificates"
                value={totalCertificates}
                icon={<Trophy size={18} strokeWidth={2} />}
              />
              {/* Earnings ledger is the source of truth for money — never
                  price × enrollments. */}
              <StatTile
                label="Earnings (net)"
                value={
                  earnings
                    ? `$${(earnings.lifetimeNetMinor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : "—"
                }
                context={
                  earnings
                    ? `$${(earnings.clearedMinor / 100).toFixed(2)} in wallet · $${(earnings.pendingMinor / 100).toFixed(2)} clearing`
                    : "lifetime"
                }
                icon={<TrendingUp size={18} strokeWidth={2} />}
                tone="success"
              />
            </div>
          ) : null}

          {/* Per-course cards */}
          {isAnyLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              art={<ArtCourses />}
              title="No courses yet"
              description="Create your first course to see analytics here."
              actionLabel="Create Course"
              actionHref="/instructor/courses/new"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const stats = certStatsMap.get(course.id)
                const ratingAvg = stats?.ratingAverage ?? 0
                const ratingCount = stats?.ratingCount ?? 0
                const certificates = stats?.totalCertificates ?? 0

                return (
                  <div
                    key={course.id}
                    className="overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface"
                  >
                    {/* Course thumbnail */}
                    <div className="relative aspect-video w-full overflow-hidden bg-ws-raised">
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
                          <span className="text-xs text-ws-subtle">No thumbnail</span>
                        </div>
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] capitalize text-white">
                        {course.status}
                      </span>
                    </div>

                    <div className="space-y-3 p-4">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ws-primary">
                        {course.title}
                      </h3>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="font-display text-lg font-semibold tabular-nums text-ws-primary">
                            {course.enrolledCount}
                          </p>
                          <p className="text-[11px] text-ws-muted">Students</p>
                        </div>
                        <div>
                          <p className="font-display text-lg font-semibold tabular-nums text-ws-primary">
                            {certificates}
                          </p>
                          <p className="text-[11px] text-ws-muted">Certificates</p>
                        </div>
                        <div>
                          <p className="font-display text-lg font-semibold tabular-nums text-ws-primary">
                            {course.pricing === "paid"
                              ? `$${((course.price ?? 0) * course.enrolledCount * 0.85).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : "Free"}
                          </p>
                          <p className="text-[11px] text-ws-muted">Revenue (est.)</p>
                        </div>
                      </div>

                      {/* Rating */}
                      <div className="flex items-center justify-between border-t border-ws-hairline pt-3">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={14}
                              strokeWidth={2}
                              fill={star <= Math.round(ratingAvg) ? "currentColor" : "none"}
                              className={
                                star <= Math.round(ratingAvg)
                                  ? "text-ws-rating"
                                  : "text-ws-subtle/40"
                              }
                            />
                          ))}
                        </div>
                        <span className="text-xs text-ws-muted">
                          {ratingCount > 0 ? (
                            <>
                              <span className="font-semibold tabular-nums text-ws-primary">
                                {ratingAvg.toFixed(1)}
                              </span>{" "}
                              ({ratingCount} {ratingCount === 1 ? "review" : "reviews"})
                            </>
                          ) : (
                            "No ratings yet"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
