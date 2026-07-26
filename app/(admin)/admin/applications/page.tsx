"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { TeachingIcon } from "@hugeicons/core-free-icons"
import { adminListApplications } from "@/lib/actions/applications"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDate, StatusBadge, FilterChips, Pagination } from "@/components/admin/shared"

type StatusFilter = "active" | "all" | "submitted" | "under_review" | "approved" | "rejected"

export default function AdminApplicationsPage() {
  const [status, setStatus] = React.useState<StatusFilter>("active")
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminApplications({ status, page }),
    queryFn: () => adminListApplications({ status, page }),
  })

  const counts = data?.counts ?? {}
  const activeCount =
    (counts.submitted ?? 0) + (counts.under_review ?? 0) + (counts.interview_scheduled ?? 0)

  return (
    <>
      <Topbar variant="admin" />
      <div className="p-4 sm:p-6 space-y-4 pb-24 md:pb-6">
        <div>
          <h1 className="text-lg font-semibold">Instructor applications</h1>
          <p className="text-sm text-muted-foreground">
            Review, interview and approve new instructors.
          </p>
        </div>

        <FilterChips
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={[
            { value: "active", label: "Needs attention", count: activeCount },
            { value: "submitted", label: "Submitted", count: counts.submitted ?? 0 },
            { value: "under_review", label: "In review", count: counts.under_review ?? 0 },
            { value: "approved", label: "Approved", count: counts.approved ?? 0 },
            { value: "rejected", label: "Rejected", count: counts.rejected ?? 0 },
            { value: "all", label: "All" },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !data || data.applications.length === 0 ? (
          <EmptyState
            icon={TeachingIcon}
            title="No applications here"
            description={
              status === "active"
                ? "Nothing is waiting on review right now."
                : "No applications match this filter."
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {data.applications.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/applications/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {a.applicantAvatar && <AvatarImage src={a.applicantAvatar} />}
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {a.applicantName[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{a.applicantName}</p>
                      <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                        {a.applicantEmail}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{a.headline}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {a.expertise.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[9px] px-1.5">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={a.status} />
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <Pagination page={data.page} pageCount={data.pageCount} onPageChange={setPage} />
          </>
        )}
      </div>
    </>
  )
}
