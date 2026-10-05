"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ReceiptTextIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { adminListEspeePayments } from "@/lib/actions/manual-payments"
import type { ManualPaymentStatus } from "@/lib/db/models"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDateTime, money, StatusBadge, FilterChips, Pagination } from "@/components/admin/shared"

/**
 * ESPEE payments (owner meeting 2026-10-03): learners who paid by ESPEE
 * transfer, waiting on an admin to check the receipt. Approving opens the
 * program; rejecting emails the learner the reason.
 */
export default function AdminEspeePaymentsPage() {
  const [status, setStatus] = React.useState<ManualPaymentStatus>("submitted")
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminEspeePayments({ status, page }),
    queryFn: () => adminListEspeePayments({ status, page }),
  })

  const counts = data?.counts

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="ESPEE payments"
            subline="Check each transfer against its receipt, then approve to open the program."
          />

          <FilterChips
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[
              { value: "submitted", label: "Submitted", count: counts?.submitted },
              { value: "approved", label: "Approved", count: counts?.approved },
              { value: "rejected", label: "Rejected", count: counts?.rejected },
            ]}
          />

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : !data || data.payments.length === 0 ? (
            <EmptyState
              icon={ReceiptTextIcon}
              title="No payments here"
              description={
                status === "submitted" ? "Nothing is waiting on review right now." : "No payments have this status yet."
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {data.payments.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/payments/espee/${p.id}`}
                    className="flex items-center gap-3 rounded-lg border border-ws-hairline bg-ws-surface px-3 py-3 transition-colors hover:bg-ws-raised"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      {p.learnerAvatar && <AvatarImage src={p.learnerAvatar} />}
                      <AvatarFallback className="text-xs bg-ws-chip text-ws-primary">
                        {p.learnerName[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{p.learnerName}</p>
                        <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                          {p.learnerEmail}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.courseTitle}
                        {p.packageName ? ` · ${p.packageName}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">Ref · {p.transferReference}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold tabular-nums">{p.amountLabel}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {money(p.amountMinor)} · {formatDateTime(p.createdAt)}
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
