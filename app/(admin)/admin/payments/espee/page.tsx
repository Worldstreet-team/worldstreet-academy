"use client"
import { ReceiptTextIcon } from "@/components/icons"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { adminGetNairaRate, adminListEspeePayments, adminSetNairaRate } from "@/lib/actions/manual-payments"
import type { ManualPaymentStatus } from "@/lib/db/models"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDateTime, money, StatusBadge, FilterChips, Pagination } from "@/components/admin/shared"
import { NAIRA_FEED_CREDIT, formatNairaRate, transferLabel } from "@/lib/payment-channels"

/**
 * Transfer payments: learners who paid by ESPEE (owner meeting 2026-10-03),
 * bank transfer or USDT (the programme document, 2026-11-05), waiting on an
 * admin to check the receipt. Approving opens the program; rejecting emails
 * the learner the reason.
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
            title="Transfer payments"
            subline="Bank, USDT and ESPEES payments. Check each one against its receipt, then approve to open the program."
          />

          <NairaRateCard />

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
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {transferLabel(p.method)} · Ref · {p.transferReference}
                      </p>
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

/**
 * The naira rate bank transfers are quoted at (client, 2026-11-05: a fixed
 * rate at checkout, updated automatically if possible): the daily market rate,
 * or a rate an admin pins here, which wins until it is cleared. Proofs already
 * submitted keep the rate they were quoted.
 */
function NairaRateCard() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminNairaRate,
    queryFn: () => adminGetNairaRate(),
  })

  const save = useMutation({
    mutationFn: (ngnPerUsd: number | null) => adminSetNairaRate(ngnPerUsd),
    onSuccess: (res) => {
      if (!res.success) {
        setError(res.error)
        return
      }
      setError(null)
      setDraft("")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminNairaRate })
    },
    onError: () => setError("Couldn't save the rate — try again"),
  })

  function pin(event: React.FormEvent) {
    event.preventDefault()
    const rate = Number(draft.replace(/[,\s₦]/g, ""))
    if (!draft.trim() || !Number.isFinite(rate)) {
      setError("Enter the rate in naira per $1")
      return
    }
    save.mutate(rate)
  }

  if (isLoading) return <Skeleton className="h-40 rounded-lg" />
  if (!data) {
    return (
      <p className="rounded-lg border border-ws-hairline bg-ws-surface p-4 text-sm text-muted-foreground">
        The bank transfer rate didn&apos;t load. Refresh the page to try again.
      </p>
    )
  }

  return (
    <section aria-labelledby="naira-rate-heading" className="rounded-lg border border-ws-hairline bg-ws-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="naira-rate-heading" className="text-sm font-semibold">
          Bank transfer rate
        </h2>
        <p className="text-sm tabular-nums">
          {data.quote ? (
            <>
              Checkout quotes <span className="font-semibold">{formatNairaRate(data.quote.ngnPerUsd)}</span> per $1
              {data.quote.source === "pinned" ? " (pinned)" : " (market)"}
            </>
          ) : (
            "No rate: checkout asks learners to confirm it on WhatsApp"
          )}
        </p>
      </div>

      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-medium">Market rate</dt>
          <dd className="mt-0.5 tabular-nums text-muted-foreground">
            {data.market
              ? `${formatNairaRate(data.market.ngnPerUsd)} · updated ${formatDateTime(data.market.asOf)}`
              : "Unavailable right now"}
            {" · "}
            <a href={NAIRA_FEED_CREDIT.href} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              {NAIRA_FEED_CREDIT.label}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-medium">Pinned rate</dt>
          <dd className="mt-0.5 tabular-nums text-muted-foreground">
            {data.pinned
              ? `${formatNairaRate(data.pinned.ngnPerUsd)} · by ${data.pinned.byName}, ${formatDateTime(data.pinned.at)}`
              : "None: checkout uses the market rate"}
          </dd>
        </div>
      </dl>

      <form onSubmit={pin} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="naira-rate">Pin a rate (₦ per $1)</Label>
          <Input
            id="naira-rate"
            inputMode="decimal"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={data.market ? String(data.market.ngnPerUsd) : "e.g. 1500"}
            className="w-44"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "naira-rate-error" : undefined}
            disabled={save.isPending}
          />
        </div>
        <Button type="submit" size="sm" disabled={save.isPending}>
          Pin rate
        </Button>
        {data.pinned && (
          <Button type="button" size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate(null)}>
            Use the market rate
          </Button>
        )}
      </form>
      {error && (
        <p id="naira-rate-error" role="alert" className="mt-2 text-xs text-ws-danger">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        A pinned rate is used until you clear it. Payments already submitted keep the rate they were quoted.
      </p>
    </section>
  )
}
