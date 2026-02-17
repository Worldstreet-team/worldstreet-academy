"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Certificate01Icon,
  Tick02Icon,
  Clock03Icon,
  UserIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from "@tanstack/react-query"
import { fetchCourseCertificates } from "@/lib/actions/certificates"
import { getMySignature } from "@/lib/actions/signature"

export default function CourseCertificatesPage() {
  const params = useParams()
  const courseId = params.courseId as string

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["instructor", "course-certificates", courseId],
    queryFn: () => fetchCourseCertificates(courseId),
  })

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
      <Topbar title="Course Certificates" variant="instructor" />
      <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/instructor/certificates" />}
                className="gap-1.5 -ml-3"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                Back
              </Button>
            </div>
            <h1 className="text-xl font-bold">Course Certificates</h1>
            <p className="text-sm text-muted-foreground">
              Students who earned certificates from this course
            </p>
          </div>
        </div>

        {/* Stats */}
        {!isLoading && certificates.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Total Certificates
                    </p>
                    <p className="text-2xl font-bold">{certificates.length}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <HugeiconsIcon
                      icon={Certificate01Icon}
                      size={20}
                      className="text-primary"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Students Signed
                    </p>
                    <p className="text-2xl font-bold">{signedCount}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={20}
                      className="text-emerald-600"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Instructor Signature */}
        {!signatureLoading && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <HugeiconsIcon icon={PencilEdit01Icon} size={16} className="text-primary" />
                    Your Signature
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    This signature appears on certificates once you sign them
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/instructor/profile" />}
                  className="gap-1.5"
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                  Edit
                </Button>
              </div>
              <div className="mt-4 rounded-lg border bg-muted/30 h-32 flex items-center justify-center">
                {instructorSignature ? (
                  <Image
                    src={instructorSignature}
                    alt="Instructor signature"
                    width={200}
                    height={80}
                    className="max-h-24 w-auto object-contain"
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <HugeiconsIcon
                      icon={PencilEdit01Icon}
                      size={24}
                      className="text-muted-foreground/30 mx-auto"
                    />
                    <p className="text-xs text-muted-foreground">
                      No signature yet. Add one in your profile.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certificates list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : certificates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HugeiconsIcon
              icon={Certificate01Icon}
              size={48}
              className="text-muted-foreground/30 mb-4"
            />
            <h3 className="font-semibold text-lg mb-1">
              No certificates yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Students will earn certificates when they complete this course.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {certificates.map((cert) => {
              const initials = cert.studentName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()

              return (
                <Card
                  key={cert.id}
                  className="transition-all hover:shadow-sm hover:border-primary/30"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 ring-2 ring-neutral-100 dark:ring-neutral-800">
                        {cert.studentAvatarUrl && (
                          <AvatarImage
                            src={cert.studentAvatarUrl}
                            alt={cert.studentName}
                          />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">
                            {cert.studentName}
                          </h3>
                          {cert.hasStudentSigned && (
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs"
                              title="Student has signed their certificate"
                            >
                              <HugeiconsIcon icon={Tick02Icon} size={10} />
                              <span className="font-medium">Signed</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <HugeiconsIcon icon={UserIcon} size={12} />
                            {cert.studentEmail}
                          </span>
                          <span className="flex items-center gap-1">
                            <HugeiconsIcon icon={Clock03Icon} size={12} />
                            {formatDate(cert.completedAt)}
                          </span>
                        </div>
                      </div>

                      {!cert.hasStudentSigned && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <HugeiconsIcon icon={Clock03Icon} size={14} />
                          <span>Awaiting signature</span>
                        </div>
                      )}
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
