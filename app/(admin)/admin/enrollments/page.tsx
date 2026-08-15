"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { RadialProgress } from "@/components/ui/radial-progress"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  adminListEnrollments,
  adminSetEnrollmentStatus,
  adminExportEnrollments,
} from "@/lib/actions/admin-enrollments"
import { queryKeys } from "@/lib/hooks/queries/keys"
import {
  formatDate,
  StatusBadge,
  FilterChips,
  Pagination,
} from "@/components/admin/shared"
import { DownloadIcon, GraduationCapIcon, MoreHorizontal, XIcon } from "lucide-react"

const ENROLLMENT_FILTERS = [
  { value: "all", label: "All" },
  { value: "pre_enrolled", label: "Pre-enrolled" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
]

const PAYMENT_FILTERS = [
  { value: "all", label: "Any payment" },
  { value: "successful", label: "Successful" },
  { value: "pending", label: "Pending" },
  { value: "not_required", label: "Not required" },
  { value: "refunded", label: "Refunded" },
]

function AdminEnrollmentsInner() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const courseId = searchParams.get("course") ?? undefined

  const [status, setStatus] = React.useState("all")
  const [payment, setPayment] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = React.useState<{ id: string; name: string } | null>(null)
  const [exporting, setExporting] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const filters = {
    course: courseId,
    status,
    payment,
    search: debouncedSearch || undefined,
    page,
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminEnrollments(filters),
    queryFn: () => adminListEnrollments(filters),
  })

  const setEnrollmentStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "cancel" | "restore" }) =>
      adminSetEnrollmentStatus(id, action),
    onSuccess: (res) => {
      setActionError(res.success ? null : (res.error ?? "Failed"))
      if (res.success) setCancelTarget(null)
      queryClient.invalidateQueries({ queryKey: ["admin", "enrollments"] })
    },
  })

  async function exportCsv() {
    setExporting(true)
    try {
      const res = await adminExportEnrollments({
        course: courseId,
        status,
        payment,
        search: debouncedSearch || undefined,
      })
      if (!res.success || !res.csv) {
        setActionError(res.error ?? "Export failed")
        return
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `enrollments-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="Enrollments"
            subline={
              data?.courseTitle
                ? `${data.total.toLocaleString()} enrollments · ${data.courseTitle}`
                : data
                  ? `${data.total.toLocaleString()} enrollments`
                  : "Who is taking what, and how it was paid."
            }
            action={
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting}>
                <DownloadIcon size={14} />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
            }
          />

          {courseId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Filtered to one course.
              <Button
                variant="ghost"
                size="xs"
                render={<Link href="/admin/enrollments" />}
              >
                <XIcon size={12} />
                Clear
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search name or email…"
                className="max-w-xs h-10 text-sm"
              />
              <FilterChips
                value={payment}
                onChange={(v) => {
                  setPayment(v)
                  setPage(1)
                }}
                options={PAYMENT_FILTERS}
              />
            </div>
            <FilterChips
              value={status}
              onChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
              options={ENROLLMENT_FILTERS}
            />
          </div>

          {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !data || data.enrollments.length === 0 ? (
            <EmptyState
              icon={GraduationCapIcon}
              title="No enrollments"
              description="No enrollments match this filter."
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-ws-hairline">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Enrolled</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead aria-label="Actions" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.enrollments.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{e.customerName}</p>
                          <p className="text-xs text-muted-foreground">{e.customerEmail}</p>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/enrollments?course=${e.courseId}`}
                            className="text-sm hover:underline"
                          >
                            {e.courseTitle}
                          </Link>
                          <p className="text-[10px] text-muted-foreground capitalize">
                            {e.courseAvailability.replace(/_/g, " ")}
                          </p>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={e.status} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={e.payment} />
                          {e.pricePaid > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              ${e.pricePaid.toFixed(2)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(e.enrolledAt)}
                          {e.completedAt && (
                            <p className="text-[10px]">done {formatDate(e.completedAt)}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <RadialProgress value={e.progress} size={22} strokeWidth={3} />
                            <span className="text-xs text-muted-foreground">{e.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon-sm" aria-label="Enrollment actions" />
                              }
                            >
                              <MoreHorizontal size={16} strokeWidth={2} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {e.status !== "suspended" && e.status !== "cancelled" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setEnrollmentStatus.mutate({ id: e.id, action: "suspend" })
                                  }
                                >
                                  Suspend
                                </DropdownMenuItem>
                              )}
                              {(e.status === "suspended" || e.status === "cancelled") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setEnrollmentStatus.mutate({ id: e.id, action: "restore" })
                                  }
                                >
                                  Restore
                                </DropdownMenuItem>
                              )}
                              {e.status !== "cancelled" && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    setCancelTarget({ id: e.id, name: e.customerName })
                                  }
                                >
                                  Cancel enrollment
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={data.page} pageCount={data.pageCount} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {cancelTarget?.name}&rsquo;s enrollment?</DialogTitle>
            <DialogDescription>
              The customer loses access to the course. This does not refund any
              payment — refunds live in Payments, where the money trail is.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
              Keep enrollment
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={setEnrollmentStatus.isPending}
              onClick={() => {
                if (cancelTarget) {
                  setEnrollmentStatus.mutate({ id: cancelTarget.id, action: "cancel" })
                }
              }}
            >
              {setEnrollmentStatus.isPending ? "Cancelling…" : "Cancel enrollment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function AdminEnrollmentsPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <AdminEnrollmentsInner />
    </Suspense>
  )
}
