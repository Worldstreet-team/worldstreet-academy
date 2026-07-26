"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { TeachingIcon } from "@hugeicons/core-free-icons"
import { adminListApplications, adminExportApplicationsCsv } from "@/lib/actions/applications"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDate, StatusBadge, FilterChips, Pagination } from "@/components/admin/shared"

type StatusFilter = "active" | "all" | "submitted" | "under_review" | "approved" | "rejected"

export default function AdminApplicationsPage() {
  const [status, setStatus] = React.useState<StatusFilter>("active")
  const [page, setPage] = React.useState(1)
  const [mine, setMine] = React.useState(false)
  const [expertise, setExpertise] = React.useState("")
  const [debouncedExpertise, setDebouncedExpertise] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedExpertise(expertise), 350)
    return () => clearTimeout(t)
  }, [expertise])

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.adminApplications({ status, page }), mine, debouncedExpertise],
    queryFn: () =>
      adminListApplications({
        status,
        page,
        mine,
        expertise: debouncedExpertise || undefined,
      }),
  })

  const exportCsv = useMutation({
    mutationFn: () => adminExportApplicationsCsv(),
    onSuccess: (res) => {
      if (!res.success) return
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "instructor-applications.csv"
      a.click()
      URL.revokeObjectURL(url)
    },
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

        <div className="flex items-center gap-3 flex-wrap">
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
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                setMine((m) => !m)
                setPage(1)
              }}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                mine
                  ? "bg-foreground text-background border-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Assigned to me
            </button>
            <Input
              value={expertise}
              onChange={(e) => {
                setExpertise(e.target.value)
                setPage(1)
              }}
              placeholder="Filter by expertise…"
              className="h-7 w-40 text-xs"
            />
            <Button
              size="xs"
              variant="outline"
              disabled={exportCsv.isPending}
              onClick={() => exportCsv.mutate()}
            >
              {exportCsv.isPending ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </div>

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
                    <div className="flex items-center gap-1.5">
                      {a.overdue && (
                        <Badge variant="destructive" className="text-[9px]">&gt;48h</Badge>
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {a.assignedToName ? `${a.assignedToName} · ` : ""}
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
