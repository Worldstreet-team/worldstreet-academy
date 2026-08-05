"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Landmark, RefreshCw } from "lucide-react"
import {
  getMyWalletOverview,
  startDollarDeposit,
  syncDollarDepositAction,
  startFiatDeposit,
  syncFiatDepositAction,
  provisionPayoutSubaccountAction,
} from "@/lib/actions/wallet"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { fmtMoney, CopyButton } from "@/components/wallet/shared"

const USD_PRESETS = [10, 25, 50, 100]
const NGN_PRESETS = [5000, 10000, 25000, 50000]

type PendingCheckout = { txRef: string; currency: "USD" | "NGN" }

function DepositPageInner() {
  const router = useRouter()
  const search = useSearchParams()
  const queryClient = useQueryClient()

  // Checkout hand-off: /dashboard/wallet/deposit?suggestMinor=1234&redirect=/dashboard/checkout?courseId=…
  const redirect = search.get("redirect")
  const suggestMinor = Number(search.get("suggestMinor") ?? "")
  const suggestedUsd = Number.isFinite(suggestMinor) && suggestMinor > 0
    ? (Math.ceil(suggestMinor / 100) + 1).toString()
    : ""

  const [usdAmount, setUsdAmount] = React.useState(suggestedUsd)
  const [fundWith, setFundWith] = React.useState<"USD" | "NGN">("USD")
  const [ngnAmount, setNgnAmount] = React.useState("")
  const [pending, setPending] = React.useState<PendingCheckout | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null)

  const { data: overview, isLoading } = useQuery({
    queryKey: queryKeys.walletOverview,
    queryFn: () => getMyWalletOverview(),
    staleTime: 15_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.walletOverview })
    queryClient.invalidateQueries({ queryKey: queryKeys.walletTransactions })
  }

  const startUsd = useMutation({
    mutationFn: () => startDollarDeposit(usdAmount, fundWith),
    onSuccess: (res) => {
      if (!res.success) {
        setError(res.error)
      } else {
        setError(null)
        setPending({ txRef: res.txRef, currency: "USD" })
        window.open(res.checkoutUrl, "_blank", "noopener")
      }
    },
  })

  const startNgn = useMutation({
    mutationFn: () => startFiatDeposit(ngnAmount),
    onSuccess: (res) => {
      if (!res.success) {
        setError(res.error)
      } else {
        setError(null)
        setPending({ txRef: res.txRef, currency: "NGN" })
        window.open(res.checkoutUrl, "_blank", "noopener")
      }
    },
  })

  const sync = useMutation({
    mutationFn: async (p: PendingCheckout) => {
      const res =
        p.currency === "USD"
          ? await syncDollarDepositAction(p.txRef)
          : await syncFiatDepositAction(p.txRef)
      return res as { success: boolean; error?: string; status?: string; availableMinor?: number }
    },
    onSuccess: (res) => {
      if (!res.success) {
        setSyncMessage(res.error ?? "Could not confirm yet")
        return
      }
      invalidate()
      if (res.status === "available" || res.status === "credited") {
        setPending(null)
        setSyncMessage(null)
        if (redirect) {
          router.push(redirect)
        } else {
          router.push("/dashboard/wallet")
        }
      } else if (res.status === "failed") {
        setPending(null)
        setSyncMessage("The payment failed — nothing was credited. You can try again.")
      } else {
        setSyncMessage("Payment not confirmed yet — give it a few seconds and sync again.")
      }
    },
  })

  const provision = useMutation({
    mutationFn: () => provisionPayoutSubaccountAction(),
    onSuccess: (res) => {
      if (!res.success) setError(res.error)
      else {
        setError(null)
        invalidate()
      }
    },
  })

  const sub = overview?.ngn?.payoutSubaccount ?? null

  return (
    <>
      <Topbar />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="">
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
              Deposit
            </h1>
            <p className="mt-1 text-[15px] text-ws-muted">
              {redirect
                ? "Top up, then you'll be taken right back to checkout."
                : "Fund your Worldstreet balance."}
            </p>
          </div>

          {/* Pending checkout banner */}
          {pending && (
            <section className="rounded-lg border border-ws-hairline bg-ws-surface p-5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-ws-brand" />
                </span>
                <p className="text-[14px] font-semibold text-ws-primary">
                  Finish your payment in the tab we opened
                </p>
              </div>
              <p className="mt-1.5 text-[13px] text-ws-muted">
                Once you&apos;ve paid, come back here and confirm — your balance updates instantly.
              </p>
              {syncMessage && <p className="mt-1.5 text-[13px] text-ws-gold">{syncMessage}</p>}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={sync.isPending}
                  onClick={() => sync.mutate(pending)}
                  className="inline-flex h-10 items-center gap-2 rounded-sm bg-ws-brand px-4 text-[13px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                >
                  <RefreshCw size={13} strokeWidth={2} className={sync.isPending ? "animate-spin" : undefined} aria-hidden />
                  {sync.isPending ? "Checking…" : "I've paid — confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => { setPending(null); setSyncMessage(null) }}
                  className="h-10 rounded-sm px-4 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          <Tabs defaultValue="usd" className="gap-5">
            <TabsList className="rounded-full bg-ws-track p-[3px] group-data-horizontal/tabs:h-10">
              <TabsTrigger
                value="usd"
                className="h-[34px] rounded-full px-4 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] data-active:bg-ws-raised data-active:font-semibold data-active:text-ws-primary group-data-[variant=default]/tabs-list:data-active:shadow-none"
              >
                USD deposit
              </TabsTrigger>
              <TabsTrigger
                value="ngn"
                className="h-[34px] rounded-full px-4 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] data-active:bg-ws-raised data-active:font-semibold data-active:text-ws-primary group-data-[variant=default]/tabs-list:data-active:shadow-none"
              >
                NGN deposit
              </TabsTrigger>
            </TabsList>

            {/* ── USD ── */}
            <TabsContent value="usd">
              <div className="space-y-6 rounded-lg border border-ws-hairline bg-ws-surface p-6">
                <div className="space-y-4">
                  <label
                    htmlFor="usd-amount"
                    className="block text-center text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted"
                  >
                    Amount (USD)
                  </label>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-display text-2xl font-medium text-ws-muted">$</span>
                    <input
                      id="usd-amount"
                      inputMode="decimal"
                      value={usdAmount}
                      onChange={(e) => setUsdAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0.00"
                      size={Math.max(usdAmount.length, 4)}
                      className="min-w-0 bg-transparent text-center font-display text-4xl font-semibold tabular-nums text-ws-primary outline-none [field-sizing:content] placeholder:text-ws-subtle"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {USD_PRESETS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setUsdAmount(String(v))}
                        className="h-9 rounded-full bg-ws-chip px-4 text-[13px] font-medium tabular-nums text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"
                      >
                        ${v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-ws-hairline pt-5">
                  <p className="text-[13px] font-medium text-ws-primary">Pay with</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFundWith("USD")}
                      className={`h-9 rounded-full border px-4 text-[13px] font-medium transition-colors duration-[var(--ws-motion-fast)] ${
                        fundWith === "USD"
                          ? "border-ws-brand bg-ws-brand/5 text-ws-primary"
                          : "border-ws-hairline text-ws-muted hover:bg-ws-raised hover:text-ws-primary"
                      }`}
                    >
                      Card (USD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundWith("NGN")}
                      className={`h-9 rounded-full border px-4 text-[13px] font-medium transition-colors duration-[var(--ws-motion-fast)] ${
                        fundWith === "NGN"
                          ? "border-ws-brand bg-ws-brand/5 text-ws-primary"
                          : "border-ws-hairline text-ws-muted hover:bg-ws-raised hover:text-ws-primary"
                      }`}
                    >
                      Naira (auto-converted)
                    </button>
                  </div>
                  {fundWith === "NGN" && (
                    <p className="text-xs text-ws-muted">
                      You&apos;ll pay the NGN equivalent at the live rate; your balance is credited in USD.
                    </p>
                  )}
                </div>

                {error && <p className="text-[13px] text-ws-danger">{error}</p>}

                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={!usdAmount || startUsd.isPending}
                    onClick={() => startUsd.mutate()}
                    className="h-[52px] w-full rounded-sm bg-ws-brand text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {startUsd.isPending ? "Opening secure checkout…" : "Continue to payment"}
                  </button>
                  <p className="text-center text-xs text-ws-subtle">
                    Secure payment via Flutterwave — opens in a new tab.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ── NGN ── */}
            <TabsContent value="ngn">
              <div className="space-y-4">
                {/* Bank transfer into the dedicated funding account */}
                <div className="space-y-4 rounded-lg border border-ws-hairline bg-ws-surface p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
                      <Landmark size={17} strokeWidth={2} className="text-ws-gold" aria-hidden />
                    </div>
                    <h3 className="text-[15px] font-semibold text-ws-primary">
                      Bank transfer (recommended)
                    </h3>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-20 rounded-md" />
                  ) : sub ? (
                    <div>
                      <div className="divide-y divide-ws-hairline">
                        <div className="flex items-center justify-between py-3">
                          <span className="text-[13px] text-ws-muted">Bank</span>
                          <span className="text-[13px] font-medium text-ws-primary">{sub.bankName}</span>
                        </div>
                        <div className="flex items-center justify-between py-3">
                          <span className="text-[13px] text-ws-muted">Account number</span>
                          <span className="inline-flex items-center gap-1 text-[14px] font-semibold tabular-nums text-ws-primary">
                            {sub.accountNumber}
                            <CopyButton value={sub.accountNumber} label="account number" />
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-3">
                          <span className="text-[13px] text-ws-muted">Account name</span>
                          <span className="text-[13px] font-medium text-ws-primary">{sub.accountName}</span>
                        </div>
                      </div>
                      <p className="border-t border-ws-hairline pt-3 text-xs text-ws-subtle">
                        Transfers to this account credit your NGN balance automatically —
                        usually within a minute.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[13px] text-ws-muted">
                        Get a dedicated account number — transfer into it any time and your
                        balance updates automatically. No BVN required.
                      </p>
                      <button
                        type="button"
                        disabled={provision.isPending}
                        onClick={() => provision.mutate()}
                        className="h-10 rounded-sm border border-ws-hairline px-4 text-[13px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised disabled:pointer-events-none disabled:opacity-50"
                      >
                        {provision.isPending ? "Creating account…" : "Create my funding account"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Hosted checkout */}
                <div className="space-y-5 rounded-lg border border-ws-hairline bg-ws-surface p-6">
                  <h3 className="text-[15px] font-semibold text-ws-primary">Card / other methods</h3>
                  <div className="space-y-4">
                    <label
                      htmlFor="ngn-amount"
                      className="block text-center text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted"
                    >
                      Amount (NGN)
                    </label>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-display text-2xl font-medium text-ws-muted">₦</span>
                      <input
                        id="ngn-amount"
                        inputMode="numeric"
                        value={ngnAmount}
                        onChange={(e) => setNgnAmount(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="0"
                        size={Math.max(ngnAmount.length, 4)}
                        className="min-w-0 bg-transparent text-center font-display text-4xl font-semibold tabular-nums text-ws-primary outline-none [field-sizing:content] placeholder:text-ws-subtle"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {NGN_PRESETS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setNgnAmount(String(v))}
                          className="h-9 rounded-full bg-ws-chip px-4 text-[13px] font-medium tabular-nums text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"
                        >
                          ₦{v.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                  {error && <p className="text-[13px] text-ws-danger">{error}</p>}
                  <button
                    type="button"
                    disabled={!ngnAmount || startNgn.isPending}
                    onClick={() => startNgn.mutate()}
                    className="h-[52px] w-full rounded-sm bg-ws-brand text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {startNgn.isPending ? "Opening secure checkout…" : "Continue to payment"}
                  </button>
                </div>

                {overview?.ngn && (
                  <p className="text-center text-[13px] tabular-nums text-ws-muted">
                    Current NGN balance: {fmtMoney(overview.ngn.availableMinor, "NGN")}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}

export default function DepositPage() {
  return (
    <React.Suspense fallback={null}>
      <DepositPageInner />
    </React.Suspense>
  )
}
