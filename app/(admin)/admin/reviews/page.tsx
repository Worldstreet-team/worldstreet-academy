"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"
import {
  adminListReviews,
  adminSetReviewModeration,
} from "@/lib/actions/admin-courses"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDate, FilterChips, Pagination } from "@/components/admin/shared"

type Filter = "all" | "reported" | "hidden"

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <HugeiconsIcon
          key={i}
          icon={StarIcon}
          size={11}
          className={i < rating ? "text-orange-500" : "text-muted-foreground/25"}
        />
      ))}
    </span>
  )
}

export default function AdminReviewsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = React.useState<Filter>("reported")
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminReviews({ filter, page }),
    queryFn: () => adminListReviews({ filter, page }),
  })

  const moderate = useMutation({
    mutationFn: ({
      reviewId,
      changes,
    }: {
      reviewId: string
      changes: { isHidden?: boolean; isApproved?: boolean }
    }) => adminSetReviewModeration(reviewId, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] }),
  })

  return (
    <>
      <Topbar variant="admin" />
      <div className="p-4 sm:p-6 space-y-4 pb-24 md:pb-6">
        <div>
          <h1 className="text-lg font-semibold">Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Moderate reported or problematic course reviews.
          </p>
        </div>

        <FilterChips
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          options={[
            { value: "reported", label: "Reported" },
            { value: "hidden", label: "Hidden" },
            { value: "all", label: "All" },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : !data || data.reviews.length === 0 ? (
          <EmptyState
            icon={StarIcon}
            title="Nothing to moderate"
            description={
              filter === "reported"
                ? "No reviews have been reported."
                : "No reviews match this filter."
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {data.reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-border/60 bg-card px-3 py-3 space-y-1.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Stars rating={r.rating} />
                    {r.title && <p className="text-sm font-medium truncate">{r.title}</p>}
                    <div className="ml-auto flex items-center gap-1.5">
                      {r.reportCount > 0 && (
                        <Badge variant="destructive" className="text-[9px]">
                          {r.reportCount} report{r.reportCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                      {r.isHidden && (
                        <Badge variant="outline" className="text-[9px]">hidden</Badge>
                      )}
                      {!r.isApproved && (
                        <Badge variant="outline" className="text-[9px]">unapproved</Badge>
                      )}
                    </div>
                  </div>
                  {r.content && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {r.content}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-[10px] text-muted-foreground truncate">
                      {r.reviewerName} on <span className="font-medium">{r.courseTitle}</span> ·{" "}
                      {formatDate(r.createdAt)}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={moderate.isPending}
                        onClick={() =>
                          moderate.mutate({
                            reviewId: r.id,
                            changes: { isHidden: !r.isHidden },
                          })
                        }
                      >
                        {r.isHidden ? "Unhide" : "Hide"}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={moderate.isPending}
                        onClick={() =>
                          moderate.mutate({
                            reviewId: r.id,
                            changes: { isApproved: !r.isApproved },
                          })
                        }
                      >
                        {r.isApproved ? "Unapprove" : "Approve"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={data.page} pageCount={data.pageCount} onPageChange={setPage} />
          </>
        )}
      </div>
    </>
  )
}
