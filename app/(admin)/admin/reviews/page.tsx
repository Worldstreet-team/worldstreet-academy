"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import {
  adminListReviews,
  adminSetReviewFeatured,
  adminSetReviewModeration,
} from "@/lib/actions/admin-courses"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDate, FilterChips, Pagination } from "@/components/admin/shared"
import { StarIcon } from "lucide-react"

type Filter = "all" | "reported" | "hidden" | "featured"

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          
          size={11}
          className={i < rating ? "text-ws-rating" : "text-ws-subtle"} />
      ))}
    </span>
  )
}

export default function AdminReviewsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = React.useState<Filter>("reported")
  const [page, setPage] = React.useState(1)
  // Per-row pending + error so one moderation doesn't lock (or blame) the rest.
  const [actingId, setActingId] = React.useState<string | null>(null)
  const [rowError, setRowError] = React.useState<{ id: string; message: string } | null>(null)

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
    onMutate: ({ reviewId }) => {
      setActingId(reviewId)
      setRowError(null)
    },
    onSuccess: (res, vars) => {
      if (!res.success) {
        setRowError({
          id: vars.reviewId,
          message: ("error" in res && res.error) || "Moderation failed",
        })
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] })
    },
    onError: (_err, vars) => {
      setRowError({ id: vars.reviewId, message: "Moderation failed — try again." })
    },
    onSettled: () => setActingId(null),
  })

  const feature = useMutation({
    mutationFn: ({ reviewId, featured }: { reviewId: string; featured: boolean }) =>
      adminSetReviewFeatured(reviewId, featured),
    onMutate: ({ reviewId }) => {
      setActingId(reviewId)
      setRowError(null)
    },
    onSuccess: (res, vars) => {
      if (!res.success) {
        setRowError({
          id: vars.reviewId,
          message: ("error" in res && res.error) || "Couldn't update the homepage",
        })
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] })
    },
    onError: (_err, vars) => {
      setRowError({ id: vars.reviewId, message: "Couldn't update the homepage — try again." })
    },
    onSettled: () => setActingId(null),
  })

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeader
          title="Reviews"
          subline="Moderate reviews and choose which ones the homepage features."
        />

        <FilterChips
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          options={[
            { value: "reported", label: "Reported" },
            { value: "hidden", label: "Hidden" },
            { value: "featured", label: "Featured" },
            { value: "all", label: "All" },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : !data || data.reviews.length === 0 ? (
          <EmptyState
            icon={StarIcon}
            title="Nothing to moderate"
            description={
              filter === "reported"
                ? "No reviews have been reported."
                : filter === "featured"
                  ? "No reviews are featured on the homepage."
                  : "No reviews match this filter."
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {data.reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-ws-hairline bg-ws-surface px-3 py-3 space-y-1.5"
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
                      {r.featured && (
                        <Badge variant="outline" className="text-[9px]">featured</Badge>
                      )}
                    </div>
                  </div>
                  {r.content && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {r.content}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <p className="text-[10px] text-muted-foreground truncate">
                      {r.reviewerName} on <span className="font-medium">{r.courseTitle}</span> ·{" "}
                      {formatDate(r.createdAt)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={actingId === r.id}
                        onClick={() => feature.mutate({ reviewId: r.id, featured: !r.featured })}
                      >
                        {r.featured ? "Remove from homepage" : "Feature on homepage"}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={actingId === r.id}
                        onClick={() =>
                          moderate.mutate({
                            reviewId: r.id,
                            changes: { isHidden: !r.isHidden },
                          })
                        }
                      >
                        {actingId === r.id ? "Saving…" : r.isHidden ? "Unhide" : "Hide"}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={actingId === r.id}
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
                  {rowError?.id === r.id && (
                    <p className="text-xs text-ws-danger">{rowError.message}</p>
                  )}
                </div>
              ))}
            </div>
            <Pagination page={data.page} pageCount={data.pageCount} onPageChange={setPage} />
          </>
        )}
        </div>
      </div>
    </>
  )
}
