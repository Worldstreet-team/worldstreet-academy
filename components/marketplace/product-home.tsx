import Link from "next/link"

import { FileIcon } from "@/components/icons"
import { Topbar } from "@/components/platform/topbar"
import { ProgramCover } from "@/components/platform/program-bits"
import { CourseRating, type OwnReview } from "@/components/learn/course-rating"
import { ProductDownloadButton } from "@/components/marketplace/product-download-button"
import { Eyebrow } from "@/components/ui/system"
import type { OwnedProduct } from "@/lib/actions/product-files"
import { FORMAT_LABEL, fileSizeLabel } from "@/lib/course-format"

/**
 * Where the owner of a template or guide lands instead of a player: the file,
 * one Download action and, for buyers, the rating. The storage key and any
 * signed URL are never rendered; Download mints a fresh link on click.
 */
export function ProductHome({
  product,
  rating,
  review,
}: {
  product: OwnedProduct
  rating: { average: number; count: number } | null
  review: OwnReview | null
}) {
  const format = FORMAT_LABEL[product.format]
  const lower = format.toLowerCase()
  const staff = product.viewer === "staff"

  return (
    <>
      <Topbar title={product.title} breadcrumbOverrides={{ [product.id]: product.title }} />
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-24 pt-6 md:px-6 md:pb-8">
        <article className="overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent">
          <ProgramCover src={product.thumbnailUrl} sizes="(min-width: 768px) 768px, 100vw" mark="lg" className="aspect-[2/1] w-full" />
          <div className="space-y-4 p-5 sm:p-6">
            <Eyebrow>{staff ? `${format} · preview` : `Your ${lower}`}</Eyebrow>
            <div>
              <h1 className="text-balance font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ws-primary sm:text-[30px]">
                {product.title}
              </h1>
              {product.shortDescription && (
                <p className="mt-2 text-pretty text-[15px] leading-relaxed text-ws-muted">{product.shortDescription}</p>
              )}
            </div>
            <p className="flex items-center gap-2 text-[14px] text-ws-primary">
              <FileIcon size={16} className="shrink-0 text-ws-subtle" aria-hidden />
              <span className="tabular-nums">
                {product.file.typeLabel} · {fileSizeLabel(product.file.sizeBytes)}
              </span>
            </p>
            {product.sellerName && <p className="text-[14px] text-ws-muted">By {product.sellerName}</p>}
            <ProductDownloadButton courseId={product.id} label={`Download ${lower}`} />
            <p className="text-[12.5px] leading-relaxed text-ws-muted">
              Each download link works for 5 minutes. Come back here whenever you need the file again.
            </p>
          </div>
        </article>

        {!staff && (
          <div className="rounded-[20px] border border-ws-hairline bg-ws-surface p-5 dark:border-transparent">
            <CourseRating
              courseId={product.id}
              courseTitle={product.title}
              currentRating={rating?.average}
              ratingCount={rating?.count}
              review={review}
              inline
            />
          </div>
        )}

        <Link
          href="/dashboard/my-courses"
          className="inline-block text-[14px] font-medium text-ws-muted underline-offset-4 transition-colors hover:text-ws-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          My programs
        </Link>
      </div>
    </>
  )
}
