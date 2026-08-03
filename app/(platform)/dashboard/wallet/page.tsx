"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ShieldCheck,
  Clock,
  Landmark,
} from "lucide-react"
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
  const pending = tx.status === "pending"
  return (
    <div className="flex min-h-[60px] items-center gap-3.5 rounded-md px-3 py-2.5 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/60">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
        {pending ? (
          <Clock size={17} strokeWidth={2} className="text-ws-muted" aria-hidden />
        ) : positive ? (
          <ArrowDownLeft size={17} strokeWidth={2} className="text-ws-success" aria-hidden />
        ) : (
          <ArrowUpRight size={17} strokeWidth={2} className="text-ws-primary" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-medium text-ws-primary">{tx.title}</p>
          {tx.status !== "completed" && <TxStatusBadge status={tx.status} />}
        </div>
        <p className="truncate text-[13px] text-ws-muted">{tx.detail}</p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-[14px] font-semibold tabular-nums ${
            pending ? "text-ws-muted" : positive ? "text-ws-success" : "text-ws-primary"
          }`}
        >
          {positive ? "+" : ""}
          {fmtMoney(tx.signedMinor, tx.currency)}
        </p>
        <p className="text-[13px] text-ws-subtle">
          {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>
      {tx.status === "pending" && tx.txRef && (tx.kind === "deposit_usd" || tx.kind === "deposit_ngn") && (
        <button
          type="button"
          disabled={syncing}
          onClick={onSync}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-ws-hairline px-3 text-xs font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <RefreshCw size={12} strokeWidth={2} className={syncing ? "animate-spin" : undefined} aria-hidden />
          {syncing ? "Checking…" : "Sync"}
        </button>
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
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <div className="">
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
              Wallet
            </h1>
            <p className="mt-1 text-[15px] text-ws-muted">
              Your Worldstreet balance — shared across the whole ecosystem.
            </p>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : !overview?.enabled ? (
            <div className="rounded-lg border border-ws-hairline bg-ws-surface px-6 py-14 text-center">
              <p className="text-[15px] font-medium text-ws-primary">Wallet unavailable</p>
              <p className="mt-1 text-[13px] text-ws-muted">
                The wallet service isn&apos;t reachable right now. Try again shortly.
              </p>
            </div>
          ) : (
            <>
              {/* Balance hero */}
              <section className="rounded-lg border border-ws-hairline bg-ws-surface p-6 md:p-8">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">
                  Available balance
                </p>
                <p className="mt-2 font-display text-4xl font-semibold tabular-nums tracking-[-0.02em] text-ws-primary md:text-5xl">
                  {fmtMoney(overview.usd?.availableMinor ?? 0, "USD")}
                </p>
                <p className="mt-2 text-[13px] text-ws-muted">
                  {fmtMoney(overview.usd?.lockedMinor ?? 0, "USD")} locked
                  {overview.usd && overview.usd.pendingSettlementMinor > 0
                    ? ` · ${fmtMoney(overview.usd.pendingSettlementMinor, "USD")} settling`
                    : ""}
                  {" · "}Course purchases are paid from this balance.
                </p>

                <div className="mt-6 flex items-center gap-3">
                  <Link
                    href="/dashboard/wallet/deposit"
                    className="inline-flex h-11 items-center gap-2 rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
                  >
                    <Plus size={16} strokeWidth={2} aria-hidden />
                    Deposit
                  </Link>
                  <Link
                    href="/dashboard/wallet/withdraw"
                    className="inline-flex h-11 items-center gap-2 rounded-sm border border-ws-hairline px-5 text-sm font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                  >
                    <ArrowUpRight size={16} strokeWidth={2} aria-hidden />
                    Withdraw
                  </Link>
                </div>

                {/* NGN balance row */}
                <div className="mt-6 flex items-start justify-between gap-4 border-t border-ws-hairline pt-5">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
                      <Landmark size={17} strokeWidth={2} className="text-ws-muted" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ws-primary">Nigerian Naira</p>
                      {overview.ngn?.payoutSubaccount ? (
                        <p className="truncate text-[13px] text-ws-muted">
                          Funding account: {overview.ngn.payoutSubaccount.bankName}{" "}
                          {overview.ngn.payoutSubaccount.accountNumber}
                        </p>
                      ) : (
                        <p className="text-[13px] text-ws-muted">
                          No funding account yet — create one on the deposit page.
                        </p>
                      )}
                      <p className="text-[13px] text-ws-subtle">
                        Fund by bank transfer, withdraw to any Nigerian bank.
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-[15px] font-semibold tabular-nums text-ws-primary">
                    {fmtMoney(overview.ngn?.availableMinor ?? 0, "NGN")}
                  </p>
                </div>
              </section>

              {/* KYC banner */}
              {needsKyc && (
                <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-ws-hairline bg-ws-surface p-5">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
                      <ShieldCheck size={18} strokeWidth={2} className="text-ws-gold" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ws-primary">
                        {kyc.status === "in_review"
                          ? "Identity verification in review"
                          : "Verify your identity to withdraw"}
                      </p>
                      <p className="text-[13px] text-ws-muted">
                        {kyc.status === "in_review"
                          ? "We'll notify you as soon as it's decided."
                          : "Takes ~2 minutes with a government ID."}
                      </p>
                      {kycError && <p className="mt-0.5 text-[13px] text-ws-danger">{kycError}</p>}
                    </div>
                  </div>
                  {kyc.status !== "in_review" && (
                    <button
                      type="button"
                      disabled={startKyc.isPending}
                      onClick={() => startKyc.mutate()}
                      className="h-9 shrink-0 rounded-sm border border-ws-hairline px-4 text-[13px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised disabled:pointer-events-none disabled:opacity-50"
                    >
                      {startKyc.isPending ? "Starting…" : kyc.status === "in_progress" ? "Resume verification" : "Verify identity"}
                    </button>
                  )}
                </section>
              )}

              {/* Transactions */}
              <section className="">
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">
                    Recent activity
                  </h2>
                  <button
                    type="button"
                    onClick={invalidate}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
                  >
                    <RefreshCw size={13} strokeWidth={2} aria-hidden /> Refresh
                  </button>
                </div>
                <div className="mt-3 rounded-lg border border-ws-hairline bg-ws-surface px-2 py-1 md:px-3">
                  {txLoading ? (
                    <div className="space-y-3 px-3 py-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 rounded-md" />
                      ))}
                    </div>
                  ) : !txData || txData.items.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <p className="text-[14px] font-medium text-ws-primary">No activity yet</p>
                      <p className="mt-1 text-[13px] text-ws-muted">
                        Deposits, purchases and withdrawals will show up here.
                      </p>
                      <Link
                        href="/dashboard/wallet/deposit"
                        className="mt-3 inline-block text-[13px] font-semibold text-ws-gold transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-80"
                      >
                        Make your first deposit
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-ws-hairline">
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
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  )
}
