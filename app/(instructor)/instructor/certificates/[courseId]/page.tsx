"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import Image from "next/image"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCertificate } from "@/components/shared/illustrations"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Check, Clock, Pencil, Trophy, User } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from "@tanstack/react-query"
import { fetchCourseCertificates } from "@/lib/actions/certificates"
import { getMySignature } from "@/lib/actions/signature"

export default function CourseCertificatesPage() {
  const params = useParams()
  const courseId = params.courseId as string

  const { data, isLoading } = useQuery({
    queryKey: ["instructor", "course-certificates", courseId],
    queryFn: () => fetchCourseCertificates(courseId),
  })

  const certificates = data?.certificates ?? []
  const courseTitle = data?.courseTitle ?? ""

  const { data: instructorSignature, isLoading: signatureLoading } = useQuery({
    queryKey: ["instructor", "signature"],
    queryFn: () => getMySignature(),
  })

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const signedCount = certificates.filter((c) => c.hasStudentSigned).length

  return (
    <>
      <Topbar
        title="Course Certificates"
        variant="instructor"
        breadcrumbOverrides={courseTitle ? { [courseId]: courseTitle } : undefined}
      />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <div className="">
            <Link
              href="/instructor/certificates"
              className="mb-2 inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Back to certificates
            </Link>
            <PageHeader
              title="Course Certificates"
              subline={
                courseTitle
                  ? `Students who earned certificates from “${courseTitle}”`
                  : "Students who earned certificates from this course"
              }
            />
          </div>

          {/* Stats */}
          {!isLoading && certificates.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatTile
                label="Total Certificates"
                value={certificates.length}
                icon={<Trophy size={18} strokeWidth={2} />}
                tone="gold"
              />
              <StatTile
                label="Students Signed"
                value={signedCount}
                context={`of ${certificates.length} certificate${certificates.length === 1 ? "" : "s"}`}
                icon={<Check size={18} strokeWidth={2} />}
                tone="success"
              />
            </div>
          )}

          {/* Instructor signature */}
          {!signatureLoading && (
            <div className="rounded-lg border border-ws-hairline bg-ws-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-ws-primary">
                    <Pencil size={16} strokeWidth={2} className="text-ws-gold" />
                    Your Signature
                  </h2>
                  <p className="text-xs text-ws-muted">
                    This signature appears on certificates once you sign them
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/instructor/profile" />}
                  className="gap-1.5"
                >
                  <Pencil size={14} strokeWidth={2} />
                  Edit
                </Button>
              </div>
              <div className="mt-4 flex h-32 items-center justify-center rounded-md border border-ws-hairline bg-ws-raised/50">
                {instructorSignature ? (
                  <Image
                    src={instructorSignature}
                    alt="Instructor signature"
                    width={200}
                    height={80}
                    className="max-h-24 w-auto object-contain"
                  />
                ) : (
                  <div className="space-y-2 text-center">
                    <Pencil size={24} strokeWidth={2} className="mx-auto text-ws-subtle" />
                    <p className="text-xs text-ws-muted">
                      No signature yet. Add one in your profile.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certificates list */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-lg border border-ws-hairline bg-ws-surface p-4"
                >
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : certificates.length === 0 ? (
            <EmptyState
              art={<ArtCertificate />}
              title="No certificates yet"
              description="Students will earn certificates when they complete this course."
            />
          ) : (
            <div className="space-y-3">
              {certificates.map((cert) => {
                const initials = cert.studentName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()

                return (
                  <div
                    key={cert.id}
                    className="rounded-lg border border-ws-hairline bg-ws-surface p-4 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 ring-1 ring-ws-hairline">
                        {cert.studentAvatarUrl && (
                          <AvatarImage src={cert.studentAvatarUrl} alt={cert.studentName} />
                        )}
                        <AvatarFallback className="bg-ws-chip text-sm text-ws-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-ws-primary">
                            {cert.studentName}
                          </h3>
                          {cert.hasStudentSigned && (
                            <div
                              className="flex items-center gap-1 rounded-full bg-ws-success/15 px-2 py-0.5 text-xs text-ws-success"
                              title="Student has signed their certificate"
                            >
                              <Check size={10} strokeWidth={2} />
                              <span className="font-medium">Signed</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-ws-muted">
                          <span className="flex items-center gap-1">
                            <User size={12} strokeWidth={2} />
                            {cert.studentEmail}
                          </span>
                          <span className="flex items-center gap-1 tabular-nums">
                            <Clock size={12} strokeWidth={2} />
                            {formatDate(cert.completedAt)}
                          </span>
                        </div>
                      </div>

                      {!cert.hasStudentSigned && (
                        <div className="flex items-center gap-1 text-xs text-ws-gold">
                          <Clock size={14} strokeWidth={2} />
                          <span>Awaiting signature</span>
                        </div>
                      )}
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
