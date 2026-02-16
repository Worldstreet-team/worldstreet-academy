import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Topbar } from "@/components/platform/topbar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Certificate01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { fetchMyCertificates } from "@/lib/actions/certificates"
import { EmptyState } from "@/components/shared/empty-state"

export default async function CertificatesPage() {
  const certificates = await fetchMyCertificates()

  return (
    <>
      <Topbar title="My Certificates" />
      <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold">Certificates</h1>
          <p className="text-sm text-muted-foreground">
            View and download certificates for your completed courses.
          </p>
        </div>

        {/* Stats */}
        {certificates.length > 0 && (
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs">
              <HugeiconsIcon icon={Certificate01Icon} size={14} className="mr-1" />
              {certificates.length} {certificates.length === 1 ? "Certificate" : "Certificates"}
            </Badge>
          </div>
        )}

        {/* Certificate list */}
        {certificates.length === 0 ? (
          <EmptyState
            illustration="/user/dashboard/course-empty-state.png"
            title="No certificates yet"
            description="Complete a course to earn your first certificate."
            actionLabel="Browse Courses"
            actionHref="/dashboard"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => {
              const completedDate = new Date(cert.completedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })

              return (
                <Link
                  key={cert.id}
                  href={`/dashboard/courses/${cert.courseId}/certificate`}
                  className="group"
                >
                  <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
                    {/* Thumbnail */}
                    <div className="aspect-video w-full bg-muted relative overflow-hidden">
                      {cert.courseThumbnail ? (
                        <Image
                          src={cert.courseThumbnail}
                          alt={cert.courseTitle}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
                          <HugeiconsIcon icon={Certificate01Icon} size={32} className="text-muted-foreground/30" />
                        </div>
                      )}
                      {/* Completed badge */}
                      <Badge className="absolute top-2.5 left-2.5 text-[10px] z-10 border border-white/30 shadow-lg backdrop-blur-md bg-white/20 text-white dark:bg-black/30 dark:border-white/20">
                        Completed
                      </Badge>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {cert.courseTitle}
                      </h3>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar size="sm">
                          {cert.instructorAvatarUrl && (
                            <AvatarImage src={cert.instructorAvatarUrl} alt={cert.instructorName} />
                          )}
                          <AvatarFallback>
                            {cert.instructorName.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{cert.instructorName}</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-[10px] text-muted-foreground">
                          Completed {completedDate}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-primary font-medium">
                          View
                          <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
