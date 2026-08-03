import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Topbar } from "@/components/platform/topbar"
import { fetchMyCertificates } from "@/lib/actions/certificates"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCertificate, SealRosette } from "@/components/shared/illustrations"
import { ChevronRightIcon } from "lucide-react"

export default async function CertificatesPage() {
  const certificates = await fetchMyCertificates()

  return (
    <>
      <Topbar title="My Certificates" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          {/* Header */}
          <div className="">
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
              Certificates
            </h1>
            <p className="mt-1 text-[15px] text-ws-muted">
              {certificates.length > 0
                ? `${certificates.length} ${certificates.length === 1 ? "credential" : "credentials"} earned by completing courses.`
                : "Credentials you earn by completing courses live here."}
            </p>
          </div>

          {certificates.length === 0 ? (
            <EmptyState
              art={<ArtCertificate />}
              title="No certificates yet"
              description="Finish a course and pass the exam to earn your first certificate."
              actionLabel="Browse courses"
              actionHref="/dashboard/courses"
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="group flex h-full flex-col rounded-lg border border-ws-hairline bg-ws-surface p-5 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                  >
                    <SealRosette className="h-10 w-10" />

                    <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.1em] text-ws-subtle">
                      Certificate of Completion
                    </p>
                    <h3 className="mt-1.5 line-clamp-2 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
                      {cert.courseTitle}
                    </h3>

                    <div className="mb-5 mt-2.5 flex items-center gap-2">
                      <Avatar size="sm">
                        {cert.instructorAvatarUrl && (
                          <AvatarImage src={cert.instructorAvatarUrl} alt={cert.instructorName} />
                        )}
                        <AvatarFallback>
                          {cert.instructorName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-[13px] text-ws-muted">
                        {cert.instructorName}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-ws-hairline pt-3">
                      <span className="text-[13px] tabular-nums text-ws-muted">
                        Completed {completedDate}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
                        View
                        <ChevronRightIcon  size={14} />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
