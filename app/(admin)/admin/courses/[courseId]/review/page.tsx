import Link from "next/link"
import { notFound } from "next/navigation"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, FileIcon } from "@/components/icons"
import { ReviewPipeline } from "@/components/admin/review-pipeline"
import { ProductDownloadButton } from "@/components/marketplace/product-download-button"
import { adminGetCourseReview } from "@/lib/actions/admin-course-review"
import { FORMAT_LABEL, fileSizeLabel, isFileFormat } from "@/lib/course-format"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function duration(sec: number | null): string {
  if (!sec || sec <= 0) return ""
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * The marketplace review page: what the Marketplace Creator submitted, and the
 * four quality checks an admin records before it can publish (institutional
 * blueprint §17). It is the only way a creator's course goes live.
 */
export default async function AdminCourseReviewPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const review = await adminGetCourseReview(courseId)
  if (!review) notFound()

  const fileFormat = isFileFormat(review.format)

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <div className="space-y-3">
            <Link
              href="/admin/courses?review=pending"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-ws-muted hover:text-ws-primary"
            >
              <ChevronLeftIcon size={14} aria-hidden />
              Review queue
            </Link>
            <PageHeader
              title={review.title}
              subline={`${FORMAT_LABEL[review.format]} by ${review.creator.name}${
                review.review.submittedAt ? ` · submitted ${formatDate(review.review.submittedAt)}` : ""
              }`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section aria-labelledby="what-to-review" className="space-y-4">
              <h2 id="what-to-review" className="font-display text-lg font-semibold text-ws-primary">
                What to review
              </h2>
              <div className="rounded-[20px] border border-ws-hairline bg-ws-surface p-5 space-y-4">
                {fileFormat ? (
                  review.productFile ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-ws-chip">
                          <FileIcon size={20} aria-hidden />
                        </span>
                        <p className="text-[15px] text-ws-primary tabular-nums">
                          {review.productFile.typeLabel} · {fileSizeLabel(review.productFile.sizeBytes)}
                        </p>
                      </div>
                      <ProductDownloadButton courseId={review.id} label="Download file" variant="outline" />
                    </div>
                  ) : (
                    <p className="text-[15px] text-ws-muted">No file has been uploaded.</p>
                  )
                ) : review.lessons.length > 0 ? (
                  <ol className="space-y-2">
                    {review.lessons.map((l, i) => (
                      <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
                        <span className="w-6 shrink-0 text-ws-muted tabular-nums">{i + 1}.</span>
                        <span className="min-w-0 flex-1 text-ws-primary">{l.title}</span>
                        <span className="text-[13px] capitalize text-ws-muted">{l.type}</span>
                        {duration(l.durationSec) && (
                          <span className="text-[13px] text-ws-muted tabular-nums">{duration(l.durationSec)}</span>
                        )}
                        {l.isFree && (
                          <span className="rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-medium text-ws-primary">
                            Free preview
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[15px] text-ws-muted">No lessons have been added.</p>
                )}
                <Button variant="outline" render={<Link href={`/admin/courses/${review.id}/edit`} />}>
                  Open in the editor
                </Button>
              </div>
            </section>

            <ReviewPipeline review={review} />
          </div>
        </div>
      </div>
    </>
  )
}
