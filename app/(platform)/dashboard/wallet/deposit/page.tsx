"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HugeiconsIcon } from "@hugeicons/react"
import { BankIcon, RefreshIcon } from "@hugeicons/core-free-icons"
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
      <div className="p-4 sm:p-6 space-y-5 pb-24 md:pb-6 max-w-2xl">
        <div>
          <h1 className="text-lg font-semibold">Deposit</h1>
          <p className="text-sm text-muted-foreground">
            {redirect
              ? "Top up, then you'll be taken right back to checkout."
              : "Fund your Worldstreet balance."}
          </p>
        </div>

        {/* Pending checkout banner */}
        {pending && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold">Finish your payment in the tab we opened</p>
              <p className="text-[11px] text-muted-foreground">
                Once you&apos;ve paid, come back here and confirm — your balance updates instantly.
              </p>
              {syncMessage && <p className="text-[11px] text-orange-600">{syncMessage}</p>}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" disabled={sync.isPending} onClick={() => sync.mutate(pending)}>
                  <HugeiconsIcon icon={RefreshIcon} size={13} />
                  {sync.isPending ? "Checking…" : "I've paid — confirm"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setPending(null); setSyncMessage(null) }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="usd">
          <TabsList>
            <TabsTrigger value="usd">USD deposit</TabsTrigger>
            <TabsTrigger value="ngn">NGN deposit</TabsTrigger>
          </TabsList>

          {/* ── USD ── */}
          <TabsContent value="usd">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Amount (USD)</label>
                  <Input
                    inputMode="decimal"
                    value={usdAmount}
                    onChange={(e) => setUsdAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="25.00"
                  />
                  <div className="flex items-center gap-1.5">
                    {USD_PRESETS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setUsdAmount(String(v))}
                        className="text-xs px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        ${v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Pay with</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFundWith("USD")}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        fundWith === "USD"
                          ? "bg-foreground text-background border-foreground"
                          : "border-border/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Card (USD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundWith("NGN")}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        fundWith === "NGN"
                          ? "bg-foreground text-background border-foreground"
                          : "border-border/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Naira (auto-converted)
                    </button>
                  </div>
                  {fundWith === "NGN" && (
                    <p className="text-[10px] text-muted-foreground">
                      You&apos;ll pay the NGN equivalent at the live rate; your balance is credited in USD.
                    </p>
                  )}
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <Button
                  className="w-full"
                  disabled={!usdAmount || startUsd.isPending}
                  onClick={() => startUsd.mutate()}
                >
                  {startUsd.isPending ? "Opening secure checkout…" : "Continue to payment"}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Secure payment via Flutterwave — opens in a new tab.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── NGN ── */}
          <TabsContent value="ngn">
            <div className="space-y-3">
              {/* Bank transfer into the dedicated funding account */}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={BankIcon} size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold">Bank transfer (recommended)</h3>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-20 rounded-lg" />
                  ) : sub ? (
                    <div className="rounded-xl bg-muted/50 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Bank</span>
                        <span className="text-xs font-medium">{sub.bankName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Account number</span>
                        <span className="text-xs font-semibold font-mono inline-flex items-center gap-1">
                          {sub.accountNumber}
                          <CopyButton value={sub.accountNumber} label="account number" />
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Account name</span>
                        <span className="text-xs font-medium">{sub.accountName}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                        Transfers to this account credit your NGN balance automatically —
                        usually within a minute.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Get a dedicated account number — transfer into it any time and your
                        balance updates automatically. No BVN required.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={provision.isPending}
                        onClick={() => provision.mutate()}
                      >
                        {provision.isPending ? "Creating account…" : "Create my funding account"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Hosted checkout */}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-semibold">Card / other methods</h3>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Amount (NGN)</label>
                    <Input
                      inputMode="numeric"
                      value={ngnAmount}
                      onChange={(e) => setNgnAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="10000"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {NGN_PRESETS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setNgnAmount(String(v))}
                          className="text-xs px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          ₦{v.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={!ngnAmount || startNgn.isPending}
                    onClick={() => startNgn.mutate()}
                  >
                    {startNgn.isPending ? "Opening secure checkout…" : "Continue to payment"}
                  </Button>
                </CardContent>
              </Card>

              {overview?.ngn && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Current NGN balance: {fmtMoney(overview.ngn.availableMinor, "NGN")}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
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
