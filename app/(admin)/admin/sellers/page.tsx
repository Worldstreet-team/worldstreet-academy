"use client"
import { ExternalLinkIcon, StoreIcon } from "@/components/icons"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import {
  adminApproveSellerApplication,
  adminListSellerApplications,
  adminRejectSellerApplication,
  type AdminSellerApplicationRow,
} from "@/lib/actions/seller-applications"
import type { SellerApplicationStatus } from "@/lib/db/models"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDateTime, StatusBadge, FilterChips, Pagination } from "@/components/admin/shared"

/**
 * Seller applications (owner, 2026-10-05: approved sellers only). Each row
 * opens to the full answers; approving opens the seller area for that person
 * (User.sellerStatus "approved" — no role change); rejecting needs a reason,
 * which is emailed to them.
 */
export default function AdminSellersPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = React.useState<SellerApplicationStatus>("submitted")
  const [page, setPage] = React.useState(1)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = React.useState<AdminSellerApplicationRow | null>(null)
  const [reason, setReason] = React.useState("")
  const [actionError, setActionError] = React.useState<string | null>(null)

  const filters = { status, page }
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminSellerApplications(filters),
    queryFn: () => adminListSellerApplications(filters),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "seller-applications"] })

  const approve = useMutation({
    mutationFn: (id: string) => adminApproveSellerApplication(id),
    onSuccess: (res) => {
      setActionError(res.success ? null : res.error)
      refresh()
    },
  })

  const reject = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => adminRejectSellerApplication(id, why),
    onSuccess: (res) => {
      if (!res.success) {
        setActionError(res.error)
        return
      }
      setActionError(null)
      setRejectTarget(null)
      setReason("")
      refresh()
    },
  })

  const counts = data?.counts

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="Marketplace Creators"
            subline="Approve the people who may sell on the marketplace. Their courses are reviewed separately, in Courses."
          />

          <FilterChips
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
              setOpenId(null)
            }}
            options={[
              { value: "submitted", label: "To review", count: counts?.submitted },
              { value: "approved", label: "Approved", count: counts?.approved },
              { value: "rejected", label: "Rejected", count: counts?.rejected },
            ]}
          />

          {actionError && <p className="text-xs text-ws-danger">{actionError}</p>}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : !data || data.applications.length === 0 ? (
            <EmptyState
              icon={StoreIcon}
              title="No applications here"
              description={
                status === "submitted" ? "Nobody is waiting on a decision right now." : "No applications have this status yet."
              }
            />
          ) : (
            <>
              <ul className="space-y-2">
                {data.applications.map((a) => {
                  const open = openId === a.id
                  return (
                    <li key={a.id} className="rounded-lg border border-ws-hairline bg-ws-surface">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : a.id)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-ws-raised"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          {a.avatarUrl && <AvatarImage src={a.avatarUrl} />}
                          <AvatarFallback className="text-xs">{a.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-ws-primary">{a.fullName}</span>
                            <StatusBadge status={a.status} />
                          </div>
                          <p className="truncate text-xs text-ws-muted">
                            {a.topic}
                            {a.school ? ` · ${SCHOOL_BY_SLUG[a.school].short}` : ""} · {a.email}
                          </p>
                        </div>
                        <span className="hidden shrink-0 text-[11px] tabular-nums text-ws-subtle sm:block">
                          {formatDateTime(a.createdAt)}
                        </span>
                      </button>

                      {open && (
                        <div className="space-y-4 border-t border-ws-hairline px-4 py-4 text-sm">
                          <dl className="grid gap-4 md:grid-cols-2">
                            <div>
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ws-subtle">Account</dt>
                              <dd className="mt-1 text-ws-primary">
                                {a.accountName} · {a.email}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ws-subtle">Sample</dt>
                              <dd className="mt-1">
                                <a
                                  href={a.sampleUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex max-w-full items-center gap-1 text-ws-primary underline underline-offset-4"
                                >
                                  <span className="truncate">{a.sampleUrl}</span>
                                  <ExternalLinkIcon size={12} className="shrink-0" aria-hidden />
                                </a>
                              </dd>
                            </div>
                            <div className="md:col-span-2">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ws-subtle">Experience</dt>
                              <dd className="mt-1 whitespace-pre-line text-ws-muted">{a.experience}</dd>
                            </div>
                            <div className="md:col-span-2">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ws-subtle">
                                Why learners should buy
                              </dt>
                              <dd className="mt-1 whitespace-pre-line text-ws-muted">{a.pitch}</dd>
                            </div>
                            {a.reason && (
                              <div className="md:col-span-2">
                                <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ws-subtle">
                                  Reason given
                                </dt>
                                <dd className="mt-1 text-ws-muted">{a.reason}</dd>
                              </div>
                            )}
                          </dl>
                          {a.status === "submitted" && (
                            <div className="flex flex-wrap justify-end gap-2 border-t border-ws-hairline pt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setReason("")
                                  setRejectTarget(a)
                                }}
                              >
                                Reject…
                              </Button>
                              <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(a.id)}>
                                {approve.isPending && approve.variables === a.id ? "Approving…" : "Approve Marketplace Creator"}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              <Pagination page={data.page} pageCount={data.pageCount} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.fullName}&rsquo;s application?</DialogTitle>
            <DialogDescription>
              The reason is emailed to them. They can apply again.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. We need a sample with clearer audio before we can approve."
            className="min-h-28"
            maxLength={1000}
            aria-label="Reason"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={reject.isPending || reason.trim().length < 5}
              onClick={() => rejectTarget && reject.mutate({ id: rejectTarget.id, why: reason })}
            >
              {reject.isPending ? "Rejecting…" : "Reject application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
