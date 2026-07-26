"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Wallet01Icon,
  BankIcon,
  ArrowUpRight01Icon,
  ArrowDownLeft01Icon,
  RefreshIcon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons"
import {
  getMyWalletOverview,
  getMyWalletTransactions,
  syncDollarDepositAction,
  syncFiatDepositAction,
  startKycAction,
  type WalletTxItem,
} from "@/lib/actions/wallet"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { fmtMoney, TxStatusBadge } from "@/components/wallet/shared"

function TxRow({ tx, onSync, syncing }: { tx: WalletTxItem; onSync?: () => void; syncing?: boolean }) {
  const positive = tx.signedMinor > 0
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
          positive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
        }`}
      >
        <HugeiconsIcon icon={positive ? ArrowDownLeft01Icon : ArrowUpRight01Icon} size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium">{tx.title}</p>
          <TxStatusBadge status={tx.status} />
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{tx.detail}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-semibold ${positive ? "text-emerald-600" : ""}`}>
          {positive ? "+" : ""}
          {fmtMoney(tx.signedMinor, tx.currency)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>
      {tx.status === "pending" && tx.txRef && (tx.kind === "deposit_usd" || tx.kind === "deposit_ngn") && (
        <Button size="xs" variant="outline" disabled={syncing} onClick={onSync}>
          <HugeiconsIcon icon={RefreshIcon} size={12} />
          {syncing ? "Checking…" : "Sync"}
        </Button>
      )}
    </div>
  )
}

export default function WalletPage() {
  const queryClient = useQueryClient()
  const [kycError, setKycError] = React.useState<string | null>(null)

  const { data: overview, isLoading } = useQuery({
    queryKey: queryKeys.walletOverview,
    queryFn: () => getMyWalletOverview(),
    staleTime: 15_000,
  })

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: queryKeys.walletTransactions,
    queryFn: () => getMyWalletTransactions(),
    staleTime: 15_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.walletOverview })
    queryClient.invalidateQueries({ queryKey: queryKeys.walletTransactions })
  }

  const syncDeposit = useMutation({
    mutationFn: async (tx: WalletTxItem) => {
      const res =
        tx.kind === "deposit_usd"
          ? await syncDollarDepositAction(tx.txRef!)
          : await syncFiatDepositAction(tx.txRef!)
      return res as { success: boolean }
    },
    onSuccess: invalidate,
  })

  const startKyc = useMutation({
    mutationFn: () => startKycAction(),
    onSuccess: (res) => {
      if (!res.success) {
        setKycError(res.error ?? "Could not start verification")
      } else if (res.alreadyVerified) {
        invalidate()
      } else if (res.verificationUrl) {
        window.open(res.verificationUrl, "_blank", "noopener")
      }
    },
  })

  const kyc = overview?.kyc
  const needsKyc = overview?.enabled && kyc && !kyc.verified

  return (
    <>
      <Topbar />
      <div className="p-4 sm:p-6 space-y-5 pb-24 md:pb-6 max-w-4xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold">Wallet</h1>
            <p className="text-sm text-muted-foreground">
              Your Worldstreet balance — shared across the whole ecosystem.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" render={<Link href="/dashboard/wallet/deposit" />}>
              Deposit
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/dashboard/wallet/withdraw" />}>
              Withdraw
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : !overview?.enabled ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium">Wallet unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">
                The wallet service isn&apos;t reachable right now. Try again shortly.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Balances */}
            <div className="grid sm:grid-cols-2 gap-3">
              <Card className="bg-gradient-to-br from-primary/[0.07] to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">US Dollar</p>
                    <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <HugeiconsIcon icon={Wallet01Icon} size={14} />
                    </div>
                  </div>
                  <p className="text-2xl font-semibold mt-1">
                    {fmtMoney(overview.usd?.availableMinor ?? 0, "USD")}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {fmtMoney(overview.usd?.lockedMinor ?? 0, "USD")} locked
                    {overview.usd && overview.usd.pendingSettlementMinor > 0
                      ? ` · ${fmtMoney(overview.usd.pendingSettlementMinor, "USD")} settling`
                      : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-2">
                    Course purchases are paid from this balance.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Nigerian Naira</p>
                    <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                      <HugeiconsIcon icon={BankIcon} size={14} />
                    </div>
                  </div>
                  <p className="text-2xl font-semibold mt-1">
                    {fmtMoney(overview.ngn?.availableMinor ?? 0, "NGN")}
                  </p>
                  {overview.ngn?.payoutSubaccount ? (
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      Funding account: {overview.ngn.payoutSubaccount.bankName}{" "}
                      {overview.ngn.payoutSubaccount.accountNumber}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      No funding account yet — create one on the deposit page.
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-2">
                    Fund by bank transfer, withdraw to any Nigerian bank.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* KYC banner */}
            {needsKyc && (
              <Card className="border-orange-500/30 bg-orange-500/5">
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
                      <HugeiconsIcon icon={SecurityCheckIcon} size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">
                        {kyc.status === "in_review"
                          ? "Identity verification in review"
                          : "Verify your identity to withdraw"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {kyc.status === "in_review"
                          ? "We'll notify you as soon as it's decided."
                          : "Takes ~2 minutes with a government ID."}
                      </p>
                      {kycError && <p className="text-[11px] text-destructive mt-0.5">{kycError}</p>}
                    </div>
                  </div>
                  {kyc.status !== "in_review" && (
                    <Button size="sm" variant="outline" disabled={startKyc.isPending} onClick={() => startKyc.mutate()}>
                      {startKyc.isPending ? "Starting…" : kyc.status === "in_progress" ? "Resume verification" : "Verify identity"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Transactions */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between px-2 pt-1 pb-2">
                  <h2 className="text-sm font-semibold">Recent activity</h2>
                  <button
                    type="button"
                    onClick={invalidate}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    <HugeiconsIcon icon={RefreshIcon} size={11} /> Refresh
                  </button>
                </div>
                {txLoading ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 rounded-xl" />
                    ))}
                  </div>
                ) : !txData || txData.items.length === 0 ? (
                  <EmptyState
                    icon={Wallet01Icon}
                    title="No activity yet"
                    description="Deposits, purchases and withdrawals will show up here."
                    actionLabel="Make your first deposit"
                    actionHref="/dashboard/wallet/deposit"
                  />
                ) : (
                  <div className="space-y-0.5">
                    {txData.items.map((tx) => (
                      <TxRow
                        key={tx.id}
                        tx={tx}
                        syncing={syncDeposit.isPending && syncDeposit.variables?.id === tx.id}
                        onSync={() => syncDeposit.mutate(tx)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
