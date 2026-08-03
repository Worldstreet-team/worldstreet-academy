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
import { PageHeader } from "@/components/shared/page-header"
import { adminListApplications, adminExportApplicationsCsv } from "@/lib/actions/applications"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDate, StatusBadge, FilterChips, Pagination } from "@/components/admin/shared"
import { GraduationCapIcon } from "lucide-react"

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
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeader
          title="Instructor applications"
          subline="Review, interview and approve new instructors."
        />

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
                  ? "bg-ws-brand text-ws-brand-on border-transparent font-medium"
                  : "border-ws-hairline text-ws-muted hover:bg-ws-raised hover:text-ws-primary"
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
              className="h-10 w-44 text-sm"
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
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : !data || data.applications.length === 0 ? (
          <EmptyState
            icon={GraduationCapIcon}
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
                  className="flex items-center gap-3 rounded-lg border border-ws-hairline bg-ws-surface px-3 py-3 transition-colors hover:bg-ws-raised"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {a.applicantAvatar && <AvatarImage src={a.applicantAvatar} />}
                    <AvatarFallback className="text-xs bg-ws-chip text-ws-primary">
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
      </div>
    </>
  )
}
