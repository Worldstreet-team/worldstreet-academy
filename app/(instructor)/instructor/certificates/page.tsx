"use client"

import Link from "next/link"
import Image from "next/image"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCertificate } from "@/components/shared/illustrations"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from "@tanstack/react-query"
import { fetchInstructorCertificateStats } from "@/lib/actions/certificates"
import { BookOpen, Star, Trophy } from "lucide-react"

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
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="Certificates & Ratings"
            subline="See how many students earned certificates and how they rate your courses."
          />

          {/* Overview stats */}
          {!isLoading && stats.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                label="Total Certificates"
                value={totalCerts}
                icon={<Trophy size={18} strokeWidth={2} />}
                tone="gold"
              />
              <StatTile
                label="Avg. Rating"
                value={avgRating}
                context={
                  ratedCourses.length > 0
                    ? `across ${ratedCourses.length} rated course${ratedCourses.length === 1 ? "" : "s"}`
                    : undefined
                }
                icon={<Star size={18} strokeWidth={2} />}
                tone="gold"
              />
              <StatTile
                label="Courses"
                value={stats.length}
                icon={<BookOpen size={18} strokeWidth={2} />}
              />
            </div>
          )}

          {/* Course list */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="space-y-2 p-3.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats.length === 0 ? (
            <EmptyState
              art={<ArtCertificate />}
              title="No certificates yet"
              description="Once students complete your courses, their certificates and ratings will appear here."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((course) => (
                <Link
                  key={course.courseId}
                  href={`/instructor/certificates/${course.courseId}`}
                  className="group block h-full"
                >
                  <article className="flex h-full flex-col overflow-hidden rounded-lg border border-ws-hairline bg-ws-surface transition-colors duration-[var(--ws-motion-fast)] group-hover:border-ws-muted/30 group-hover:bg-ws-raised">
                    <div className="relative aspect-video w-full overflow-hidden bg-ws-raised">
                      {course.courseThumbnail ? (
                        <Image
                          src={course.courseThumbnail}
                          alt={course.courseTitle}
                          fill
                          className="object-cover transition-[filter] duration-[var(--ws-motion-base)] group-hover:brightness-110"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-ws-subtle">No thumbnail</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ws-primary">
                        {course.courseTitle}
                      </h3>

                      <div className="flex items-center gap-4 text-xs text-ws-muted">
                        <div className="flex items-center gap-1.5">
                          <Trophy size={14} strokeWidth={2} className="text-ws-gold" />
                          <span>
                            <span className="font-semibold tabular-nums text-ws-primary">
                              {course.totalCertificates}
                            </span>{" "}
                            {course.totalCertificates === 1 ? "certificate" : "certificates"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star
                            size={14}
                            strokeWidth={2}
                            fill="currentColor"
                            className="text-ws-rating"
                          />
                          <span>
                            {course.ratingCount > 0 ? (
                              <>
                                <span className="font-semibold tabular-nums text-ws-primary">
                                  {course.ratingAverage.toFixed(1)}
                                </span>
                                <span className="text-ws-muted"> ({course.ratingCount})</span>
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
                            <Star
                              key={star}
                              size={12}
                              strokeWidth={2}
                              fill={star <= Math.round(course.ratingAverage) ? "currentColor" : "none"}
                              className={
                                star <= Math.round(course.ratingAverage)
                                  ? "text-ws-rating"
                                  : "text-ws-subtle/40"
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
