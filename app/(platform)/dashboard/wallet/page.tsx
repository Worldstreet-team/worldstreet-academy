"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowDownLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  BankIcon,
  Clock01Icon,
  DollarCircleIcon,
  RefreshIcon,
  SecurityCheckIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import {
  ActionPill,
  Balance,
  CardHeader,
  CardShell,
  EmptyState,
  Eyebrow,
  IconAction,
  PageHeader,
  Rise,
  Segmented,
  Skel,
  type SegmentedOption,
} from "@/components/ui/system"
import {
  getMyWalletOverview,
  getMyWalletTransactions,
  syncDollarDepositAction,
  syncFiatDepositAction,
  startKycAction,
  type WalletTxItem,
  type WalletTxKind,
  type WalletUnavailableReason,
} from "@/lib/actions/wallet"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { fmtMoney, NAIRA_FONT, TxStatusBadge, useBalanceHidden } from "@/components/wallet/shared"
import { cn } from "@/lib/utils"

/** Where the balance lives when this environment has no wallet connection. */
const HUB_WALLET_URL = "https://dashboard.worldstreetgold.com"

/** Secondary figures mask to this; the hero uses Balance's own `$••••••`. */
const MASK = "••••"

type GlyphProps = { className?: string }
const DepositGlyph = ({ className }: GlyphProps) => <HugeiconsIcon icon={ArrowDownLeft01Icon} className={className} />
const WithdrawGlyph = ({ className }: GlyphProps) => <HugeiconsIcon icon={ArrowUpRight01Icon} className={className} />
const VerifyGlyph = ({ className }: GlyphProps) => <HugeiconsIcon icon={SecurityCheckIcon} className={className} />
const DollarGlyph = ({ className }: GlyphProps) => <HugeiconsIcon icon={DollarCircleIcon} className={className} />
const NairaGlyph = ({ className }: GlyphProps) => <HugeiconsIcon icon={BankIcon} className={className} />
const RefreshGlyph = ({ className }: GlyphProps) => <HugeiconsIcon icon={RefreshIcon} className={className} />
const ShowGlyph = ({ className }: GlyphProps) => <HugeiconsIcon icon={ViewIcon} className={className} />
const HideGlyph = ({ className }: GlyphProps) => <HugeiconsIcon icon={ViewOffIcon} className={className} />

/* ── Transactions filter ─────────────────────────────────────────────────── */

type TxFilter = "all" | "deposits" | "withdrawals" | "purchases"

const TX_FILTERS: readonly SegmentedOption<TxFilter>[] = [
  { key: "all", label: "All" },
  { key: "deposits", label: "Deposits" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "purchases", label: "Purchases" },
]

/** Refunds file under Purchases — each one returns a course purchase. */
const FILTER_KINDS: Record<Exclude<TxFilter, "all">, readonly WalletTxKind[]> = {
  deposits: ["deposit_usd", "deposit_ngn"],
  withdrawals: ["withdrawal_ngn"],
  purchases: ["purchase", "refund"],
}

const EMPTY_COPY: Record<TxFilter, { title: string; description: string; cta?: { label: string; href: string } }> = {
  all: {
    title: "No activity yet",
    description: "Deposits, purchases and withdrawals will show up here.",
    cta: { label: "Make your first deposit", href: "/dashboard/wallet/deposit" },
  },
  deposits: {
    title: "No deposits yet",
    description: "Top up in dollars or naira and each deposit will show up here.",
    cta: { label: "Deposit", href: "/dashboard/wallet/deposit" },
  },
  withdrawals: {
    title: "No withdrawals yet",
    description: "Naira you send to a Nigerian bank account will show up here.",
  },
  purchases: {
    title: "No purchases yet",
    description: "Courses paid from this balance, and any refunds, will show up here.",
    cta: { label: "Browse programs", href: "/dashboard/courses" },
  },
}

function shortDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Signed with a true minus (design-system/02) — direction never rides on colour alone. */
function signedAmount(tx: WalletTxItem): string {
  const sign = tx.signedMinor > 0 ? "+" : tx.signedMinor < 0 ? "−" : ""
  return `${sign}${fmtMoney(Math.abs(tx.signedMinor), tx.currency)}`
}

/* ── Rows ────────────────────────────────────────────────────────────────── */

const chevron = <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />

/**
 * ListRow geometry (40px gold rounded-square chip, 14px title, 12.5px muted
 * subtitle, `px-4 py-3`), but the subtitle WRAPS: a funding account number or
 * the "create one on the deposit page" hint must not truncate on a phone.
 */
function BalanceRow({
  icon: Icon,
  title,
  subtitle,
  amount,
  amountStyle,
  href,
}: {
  icon: React.ComponentType<GlyphProps>
  title: string
  subtitle: string
  amount: string
  amountStyle?: React.CSSProperties
  href?: string
}) {
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/[0.12]">
        <Icon className="h-[18px] w-[18px] text-primary" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium">{title}</span>
        <span className="text-[12.5px] text-muted-foreground">{subtitle}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-right text-[14px] font-semibold tabular-nums" style={amountStyle}>
        {amount}
      </span>
      {href && chevron}
    </>
  )
  const cls = "flex w-full items-center gap-3 px-4 py-3 text-left"
  return href ? (
    <Link
      href={href}
      className={cn(
        cls,
        "transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      )}
    >
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function TxRow({
  tx,
  hidden,
  onSync,
  syncing,
}: {
  tx: WalletTxItem
  hidden: boolean
  onSync?: () => void
  syncing?: boolean
}) {
  const positive = tx.signedMinor > 0
  const settled = tx.status === "completed"
  const canSync =
    tx.status === "pending" && !!tx.txRef && (tx.kind === "deposit_usd" || tx.kind === "deposit_ngn")

  // Direction chip: received = credit wash + arrow-down-left; sent = neutral
  // raised step + arrow-up-right (a purchase isn't an alarm); not yet settled =
  // muted clock; failed = debit wash. Mono so the chip colour is the whole glyph.
  const chip =
    tx.status === "failed"
      ? { icon: AlertCircleIcon, className: "bg-debit-chip text-debit" }
      : !settled
        ? { icon: Clock01Icon, className: "bg-accent text-muted-foreground" }
        : positive
          ? { icon: ArrowDownLeft01Icon, className: "bg-credit-chip text-credit" }
          : { icon: ArrowUpRight01Icon, className: "bg-accent text-foreground" }

  return (
    // Grid so the Sync pill sits in the row on wide cards and drops under the
    // text on a phone, without rendering the button twice.
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto]">
      <span className={cn("ws-icon-mono flex h-10 w-10 items-center justify-center rounded-md", chip.className)}>
        <HugeiconsIcon icon={chip.icon} aria-hidden className="h-[18px] w-[18px]" />
      </span>
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-medium">{tx.title}</span>
          {!settled && <TxStatusBadge status={tx.status} />}
        </div>
        <span className="truncate text-[12.5px] text-muted-foreground">{tx.detail}</span>
      </div>
      <div className="flex flex-col items-end">
        <span
          className={cn(
            "whitespace-nowrap text-[14px] font-semibold tabular-nums",
            !settled ? "text-muted-foreground" : positive ? "text-credit" : "text-foreground",
            tx.status === "failed" && "line-through"
          )}
          style={tx.currency === "NGN" ? NAIRA_FONT.sans : undefined}
        >
          {hidden ? MASK : signedAmount(tx)}
        </span>
        <span className="text-[12px] tabular-nums text-muted-foreground">{shortDate(tx.createdAt)}</span>
      </div>
      {canSync && (
        <button
          type="button"
          disabled={syncing}
          onClick={onSync}
          className="ws-icon-mono col-start-2 col-end-4 inline-flex h-9 items-center gap-1.5 justify-self-start rounded-full border border-border px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 sm:col-start-4 sm:col-end-5 sm:row-start-1 sm:h-8"
        >
          <HugeiconsIcon icon={RefreshIcon} aria-hidden className="h-3.5 w-3.5" />
          {syncing ? "Checking…" : "Sync"}
        </button>
      )}
    </li>
  )
}

/* ── Loading and unavailable states ──────────────────────────────────────── */

function RowSkeletons({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-border border-t border-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skel className="h-10 w-10 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skel className="h-3.5 w-28 max-w-[55%]" />
            <Skel className="h-3 w-40 max-w-[75%]" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skel className="h-3.5 w-16" />
            <Skel className="h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  )
}

function CardHeaderSkeleton({ segmented }: { segmented?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex flex-col gap-1.5">
        <Skel className="h-4 w-24" />
        <Skel className="h-3 w-48 max-w-full" />
      </div>
      {segmented && <Skel className="h-7 w-72 max-w-full rounded-full" />}
    </div>
  )
}

function WalletSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading wallet" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skel className="h-3 w-32" />
        <Skel className="h-[clamp(2.75rem,5.5vw,4.5rem)] w-60 max-w-full rounded-lg" />
        <Skel className="h-3 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skel className="h-12 w-32 rounded-full" />
        <Skel className="h-12 w-32 rounded-full" />
      </div>
      <CardShell>
        <CardHeaderSkeleton />
        <RowSkeletons rows={2} />
      </CardShell>
      <CardShell>
        <CardHeaderSkeleton segmented />
        <RowSkeletons rows={4} />
      </CardShell>
    </div>
  )
}

function WalletUnavailable({
  reason,
  retrying,
  onRetry,
}: {
  reason: WalletUnavailableReason | undefined
  retrying: boolean
  onRetry: () => void
}) {
  if (reason === "not_configured") {
    return (
      <CardShell>
        <EmptyState
          illustration="beneficiaries"
          title="Wallet isn't connected here"
          description="Payments are switched off in this environment, so deposits, withdrawals and paid enrollment won't work here. Your balance lives in your WorldStreet wallet."
          ctas={[{ label: "Open the WorldStreet wallet", href: HUB_WALLET_URL }]}
        />
      </CardShell>
    )
  }
  // No borrowed art on an error — just what happened, whether money moved, and what to do.
  return (
    <CardShell>
      <EmptyState
        title="Wallet is temporarily unreachable"
        description="We couldn't reach the WorldStreet wallet just now. Nothing was charged or moved — try again in a moment."
        ctas={[{ label: retrying ? "Retrying…" : "Retry", onClick: onRetry }]}
      />
    </CardShell>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function WalletPage() {
  const queryClient = useQueryClient()
  const [kycError, setKycError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<TxFilter>("all")
  const [hidden, toggleHidden] = useBalanceHidden()

  const {
    data: overview,
    isLoading,
    isFetching: overviewFetching,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: queryKeys.walletOverview,
    queryFn: () => getMyWalletOverview(),
    staleTime: 15_000,
  })

  const {
    data: txData,
    isLoading: txLoading,
    isFetching: txFetching,
    refetch: refetchTx,
  } = useQuery({
    queryKey: queryKeys.walletTransactions,
    queryFn: () => getMyWalletTransactions(),
    staleTime: 15_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.walletOverview })
    queryClient.invalidateQueries({ queryKey: queryKeys.walletTransactions })
  }

  const retry = () => {
    void refetchOverview()
    void refetchTx()
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

  const usd = overview?.usd ?? null
  const ngn = overview?.ngn ?? null
  const fundingAccount = ngn?.payoutSubaccount ?? null
  const usdFigure = (minor: number) => (hidden ? MASK : fmtMoney(minor, "USD"))

  const items = txData?.items ?? []
  const visible = filter === "all" ? items : items.filter((tx) => FILTER_KINDS[filter].includes(tx.kind))
  const empty = EMPTY_COPY[filter]

  return (
    <>
      <Topbar />
      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <PageHeader
            title="Wallet"
            subtitle="Your WorldStreet balance — shared across the whole ecosystem."
            actions={
              overview?.enabled ? (
                <IconAction icon={RefreshGlyph} label="Refresh wallet" onClick={invalidate} />
              ) : undefined
            }
          />

          {isLoading ? (
            <WalletSkeleton />
          ) : !overview?.enabled ? (
            <WalletUnavailable reason={overview?.reason} retrying={overviewFetching || txFetching} onRetry={retry} />
          ) : (
            <>
              {/* Hero — the dollar balance; course purchases draw on it. */}
              <Rise>
                <section aria-label="Dollar balance" className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <Eyebrow>Available balance</Eyebrow>
                    {/* Mono: the eye's colour is its state (gold = figures hidden). */}
                    <span className="ws-icon-mono">
                      <IconAction
                        icon={hidden ? HideGlyph : ShowGlyph}
                        label={hidden ? "Show balances" : "Hide balances"}
                        onClick={toggleHidden}
                        active={hidden}
                      />
                    </span>
                  </div>
                  <Balance value={usd ? fmtMoney(usd.availableMinor, "USD") : "—"} hidden={hidden} />
                  <p className="text-[13px] tabular-nums text-muted-foreground">
                    {usd ? (
                      <>
                        {usdFigure(usd.lockedMinor)} locked
                        {usd.pendingSettlementMinor > 0 && ` · ${usdFigure(usd.pendingSettlementMinor)} settling`}
                        {" · "}Course purchases are paid from this balance.
                      </>
                    ) : (
                      "Your dollar balance didn't load — refresh to try again."
                    )}
                  </p>
                </section>
              </Rise>

              {/* Action rail */}
              <Rise delay={60}>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <ActionPill icon={DepositGlyph} label="Deposit" href="/dashboard/wallet/deposit" />
                    <ActionPill icon={WithdrawGlyph} label="Withdraw" href="/dashboard/wallet/withdraw" />
                    {needsKyc && kyc.status !== "in_review" && (
                      <ActionPill
                        icon={VerifyGlyph}
                        label={
                          startKyc.isPending
                            ? "Starting…"
                            : kyc.status === "in_progress"
                              ? "Resume verification"
                              : "Verify identity"
                        }
                        onClick={() => {
                          if (!startKyc.isPending) startKyc.mutate()
                        }}
                      />
                    )}
                  </div>
                  {needsKyc && (
                    <p className="text-[13px] text-muted-foreground">
                      {kyc.status === "in_review"
                        ? "Identity verification is in review — we'll notify you as soon as it's decided."
                        : "Withdrawals need a verified identity — it takes about 2 minutes with a government ID."}
                    </p>
                  )}
                  {kycError && (
                    <p role="alert" className="text-[13px] text-debit">
                      {kycError}
                    </p>
                  )}
                </div>
              </Rise>

              {/* Balances */}
              <Rise delay={120}>
                <CardShell>
                  <CardHeader title="Balances" subtitle="Dollars pay for courses; naira funds by bank transfer." />
                  <div className="divide-y divide-border border-t border-border">
                    <BalanceRow
                      icon={DollarGlyph}
                      title="US Dollar"
                      subtitle={usd ? `${usdFigure(usd.lockedMinor)} locked` : "Couldn't load right now"}
                      amount={usd ? usdFigure(usd.availableMinor) : "—"}
                    />
                    <BalanceRow
                      icon={NairaGlyph}
                      title="Nigerian Naira"
                      subtitle={
                        !ngn
                          ? "Couldn't load right now"
                          : fundingAccount
                            ? `Funding account · ${fundingAccount.bankName} ${fundingAccount.accountNumber}`
                            : "No funding account yet — create one on the deposit page"
                      }
                      amount={ngn ? (hidden ? MASK : fmtMoney(ngn.availableMinor, "NGN")) : "—"}
                      amountStyle={NAIRA_FONT.sans}
                      href={ngn && !fundingAccount ? "/dashboard/wallet/deposit" : undefined}
                    />
                  </div>
                </CardShell>
              </Rise>

              {/* Transactions */}
              <Rise delay={180}>
                <CardShell>
                  <CardHeader
                    title="Transactions"
                    subtitle="Deposits, withdrawals and purchases"
                    className="flex-wrap"
                    right={<Segmented size="sm" options={TX_FILTERS} value={filter} onChange={setFilter} />}
                  />
                  {txLoading ? (
                    <div role="status" aria-busy="true" aria-label="Loading transactions">
                      <RowSkeletons rows={4} />
                    </div>
                  ) : !txData?.enabled ? (
                    <div className="border-t border-border">
                      <EmptyState
                        title="Transactions didn't load"
                        description="Your balances are up to date, but your activity didn't come through. Nothing was charged or moved."
                        ctas={[{ label: txFetching ? "Retrying…" : "Retry", onClick: () => void refetchTx() }]}
                      />
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="border-t border-border">
                      <EmptyState
                        illustration="noTransactions"
                        title={empty.title}
                        description={empty.description}
                        ctas={empty.cta ? [empty.cta] : []}
                      />
                    </div>
                  ) : (
                    <ul className="divide-y divide-border border-t border-border">
                      {visible.map((tx) => (
                        <TxRow
                          key={tx.id}
                          tx={tx}
                          hidden={hidden}
                          syncing={syncDeposit.isPending && syncDeposit.variables?.id === tx.id}
                          onSync={() => syncDeposit.mutate(tx)}
                        />
                      ))}
                    </ul>
                  )}
                </CardShell>
              </Rise>
            </>
          )}
        </div>
      </div>
    </>
  )
}
