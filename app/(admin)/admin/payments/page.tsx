"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DollarCircleIcon } from "@hugeicons/core-free-icons"
import {
  adminListOrders,
  adminGetOrderDetail,
  adminListEarnings,
  adminRunReconciliation,
  type ReconcileFinding,
} from "@/lib/actions/admin-payments"
import { refundEnrollment } from "@/lib/actions/earnings"
import { queryKeys } from "@/lib/hooks/queries/keys"
import {
  money,
  formatDateTime,
  StatusBadge,
  FilterChips,
  Pagination,
} from "@/components/admin/shared"

/* ═════════════ Orders tab ═════════════ */

function OrdersTab() {
  const queryClient = useQueryClient()
  const [status, setStatus] = React.useState("all")
  const [page, setPage] = React.useState(1)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [refundOpen, setRefundOpen] = React.useState(false)
  const [refundReason, setRefundReason] = React.useState("")
  const [refundError, setRefundError] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminOrders({ status, page }),
    queryFn: () => adminListOrders({ status, page }),
  })

  const { data: detail } = useQuery({
    queryKey: selectedId ? queryKeys.adminOrderDetail(selectedId) : ["admin", "order", "none"],
    queryFn: () => (selectedId ? adminGetOrderDetail(selectedId) : null),
    enabled: !!selectedId,
  })

  const refund = useMutation({
    mutationFn: ({ enrollmentId, reason }: { enrollmentId: string; reason: string }) =>
      refundEnrollment(enrollmentId, reason),
    onSuccess: (res) => {
      if (!res.success) {
        setRefundError(res.error ?? "Refund failed")
      } else {
        setRefundError(null)
        setRefundOpen(false)
        setRefundReason("")
        queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
        if (selectedId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.adminOrderDetail(selectedId) })
        }
      }
    },
  })

  return (
    <div className="space-y-4">
      <FilterChips
        value={status}
        onChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
        options={[
          { value: "all", label: "All" },
          { value: "enrolled", label: "Enrolled" },
          { value: "paid", label: "Paid" },
          { value: "failed", label: "Failed" },
          { value: "refunded", label: "Refunded" },
          { value: "payment_requested", label: "Requested" },
        ]}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : !data || data.orders.length === 0 ? (
        <EmptyState
          icon={DollarCircleIcon}
          title="No orders"
          description="No orders match this filter."
        />
      ) : (
        <>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="hidden md:table-cell">Buyer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelectedId(o.id)}>
                    <TableCell>
                      <p className="font-medium truncate max-w-[180px]">{o.courseTitle}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                        {o.reference}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="truncate max-w-[160px]">{o.buyerName}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                        {o.buyerEmail}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {money(o.amountMinor, o.currency)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatDateTime(o.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.page} pageCount={data.pageCount} onPageChange={setPage} />
        </>
      )}

      {/* Order detail dialog */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.courseTitle}
                  <StatusBadge status={detail.status} />
                </DialogTitle>
                <DialogDescription>
                  {detail.buyerName} · {detail.buyerEmail}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                    <p className="text-muted-foreground text-[10px]">Amount</p>
                    <p className="font-semibold text-sm">
                      {money(detail.amountMinor, detail.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                    <p className="text-muted-foreground text-[10px]">Enrollment</p>
                    <p className="font-medium capitalize">
                      {detail.enrollment ? detail.enrollment.status : "none"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Reference / charge</p>
                  <p className="font-mono text-[10px] break-all">{detail.reference}</p>
                  {detail.chargeId && (
                    <p className="font-mono text-[10px] break-all text-muted-foreground">
                      {detail.chargeId}
                    </p>
                  )}
                </div>

                {detail.earning && (
                  <div className="rounded-lg border border-border/60 px-2.5 py-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Instructor earning</span>
                    <span className="flex items-center gap-2">
                      {money(detail.earning.netMinor)}
                      <StatusBadge status={detail.earning.status} />
                    </span>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Timeline</p>
                  <div className="space-y-1.5">
                    {detail.history.map((h, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1 shrink-0" />
                        <div>
                          <span className="font-medium capitalize">
                            {h.status.replace(/_/g, " ")}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {formatDateTime(h.at)}
                          </span>
                          {h.note && <p className="text-muted-foreground">{h.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {detail.events.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Payment events</p>
                    <div className="flex flex-wrap gap-1">
                      {detail.events.map((e) => (
                        <Badge key={e.id} variant="outline" className="text-[9px]">
                          {e.type.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {detail.refundable && detail.enrollment && (
                <DialogFooter>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setRefundError(null)
                      setRefundOpen(true)
                    }}
                  >
                    Refund purchase
                  </Button>
                </DialogFooter>
              )}
            </>
          ) : (
            <div className="space-y-2 py-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund confirm */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund this purchase?</DialogTitle>
            <DialogDescription>
              Re-credits the student&apos;s Worldstreet wallet in full, revokes course access, and
              claws back the instructor&apos;s share from the earnings ledger. This can&apos;t be
              undone from here.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Reason (required, kept in the audit trail)…"
            className="text-xs min-h-16"
          />
          {refundError && <p className="text-xs text-destructive">{refundError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!refundReason.trim() || refund.isPending}
              onClick={() => {
                if (detail?.enrollment) {
                  refund.mutate({ enrollmentId: detail.enrollment.id, reason: refundReason })
                }
              }}
            >
              {refund.isPending ? "Refunding…" : "Confirm refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ═════════════ Earnings tab ═════════════ */

function EarningsTab() {
  const [status, setStatus] = React.useState("all")
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminEarnings({ status, page }),
    queryFn: () => adminListEarnings({ status, page }),
  })

  return (
    <div className="space-y-4">
      <FilterChips
        value={status}
        onChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
        options={[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "cleared", label: "Cleared" },
          { value: "reversed", label: "Reversed" },
        ]}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : !data || data.earnings.length === 0 ? (
        <EmptyState
          icon={DollarCircleIcon}
          title="No earnings rows"
          description="No instructor earnings match this filter."
        />
      ) : (
        <>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instructor</TableHead>
                  <TableHead className="hidden md:table-cell">Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.earnings.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <p className="font-medium truncate max-w-[160px] flex items-center gap-1.5">
                        {e.instructorName}
                        {e.kind === "adjustment" && (
                          <Badge variant="destructive" className="text-[8px]">clawback</Badge>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      <span className="truncate max-w-[200px] block">{e.courseTitle}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${e.netMinor < 0 ? "text-destructive" : ""}`}
                    >
                      {money(e.netMinor)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatDateTime(e.createdAt)}
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
  )
}

/* ═════════════ Reconcile tab ═════════════ */

function ReconcileTab() {
  const [result, setResult] = React.useState<{
    findings: ReconcileFinding[]
    checkedOrders: number
    error?: string
  } | null>(null)

  const run = useMutation({
    mutationFn: () => adminRunReconciliation(),
    onSuccess: (res) => {
      setResult({
        findings: res.findings,
        checkedOrders: res.checkedOrders,
        error: res.success ? undefined : res.error,
      })
    },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
        <h3 className="text-sm font-semibold">Wallet reconciliation</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Compares academy orders against the central wallet&apos;s charge records: missing
          charges, amount drift, refunded charges still granting access, and orphaned charges.
          This report is <span className="font-medium text-foreground">read-only</span> — to
          repair access drift, run{" "}
          <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
            node scripts/reconcile-orders.mjs --heal
          </code>{" "}
          from ops.
        </p>
        <Button size="sm" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "Checking against wallet…" : "Run report"}
        </Button>
      </div>

      {result && (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
          {result.error ? (
            <p className="text-xs text-destructive">{result.error}</p>
          ) : result.findings.length === 0 ? (
            <p className="text-xs text-emerald-600 font-medium">
              ✓ Clean — {result.checkedOrders} orders agree with the wallet service.
            </p>
          ) : (
            <>
              <p className="text-xs font-semibold">
                {result.findings.length} finding{result.findings.length === 1 ? "" : "s"} across{" "}
                {result.checkedOrders} orders
              </p>
              <div className="space-y-1.5">
                {result.findings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                        f.severity === "error" ? "bg-destructive" : "bg-orange-400"
                      }`}
                    />
                    <p className="font-mono text-[11px] break-all">{f.message}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ═════════════ Page ═════════════ */

export default function AdminPaymentsPage() {
  return (
    <>
      <Topbar variant="admin" />
      <div className="p-4 sm:p-6 space-y-4 pb-24 md:pb-6">
        <div>
          <h1 className="text-lg font-semibold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Orders, instructor earnings and wallet reconciliation.
          </p>
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
          </TabsList>
          <TabsContent value="orders">
            <OrdersTab />
          </TabsContent>
          <TabsContent value="earnings">
            <EarningsTab />
          </TabsContent>
          <TabsContent value="reconcile">
            <ReconcileTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
