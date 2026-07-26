"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { BankIcon, SecurityCheckIcon, Delete02Icon } from "@hugeicons/core-free-icons"
import {
  getMyWalletOverview,
  getNgnBanks,
  getMySavedBanks,
  verifyBankAction,
  addBankAction,
  deleteBankAction,
  withdrawNgn,
  startKycAction,
  syncKycAction,
} from "@/lib/actions/wallet"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { fmtMoney } from "@/components/wallet/shared"

export default function WithdrawPage() {
  const queryClient = useQueryClient()

  const [amount, setAmount] = React.useState("")
  const [selectedBankId, setSelectedBankId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  // Add-bank dialog state
  const [addOpen, setAddOpen] = React.useState(false)
  const [bankSearch, setBankSearch] = React.useState("")
  const [chosenBank, setChosenBank] = React.useState<{ code: string; name: string } | null>(null)
  const [accountNumber, setAccountNumber] = React.useState("")
  const [verifiedName, setVerifiedName] = React.useState<string | null>(null)
  const [addError, setAddError] = React.useState<string | null>(null)

  // KYC state
  const [kycSessionId, setKycSessionId] = React.useState<string | null>(null)
  const [kycMsg, setKycMsg] = React.useState<string | null>(null)

  const { data: overview, isLoading } = useQuery({
    queryKey: queryKeys.walletOverview,
    queryFn: () => getMyWalletOverview(),
    staleTime: 15_000,
  })

  const { data: savedBanks = [], isLoading: banksLoading } = useQuery({
    queryKey: queryKeys.walletSavedBanks,
    queryFn: () => getMySavedBanks(),
  })

  const { data: directory = [] } = useQuery({
    queryKey: queryKeys.walletBanks,
    queryFn: () => getNgnBanks(),
    enabled: addOpen,
    staleTime: 3600_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.walletOverview })
    queryClient.invalidateQueries({ queryKey: queryKeys.walletTransactions })
    queryClient.invalidateQueries({ queryKey: queryKeys.walletSavedBanks })
  }

  const verify = useMutation({
    mutationFn: () => verifyBankAction(chosenBank!.code, chosenBank!.name, accountNumber),
    onSuccess: (res) => {
      if (!res.success) setAddError(res.error)
      else {
        setAddError(null)
        setVerifiedName(res.accountName)
      }
    },
  })

  const addBank = useMutation({
    mutationFn: () =>
      addBankAction({
        bankCode: chosenBank!.code,
        bankName: chosenBank!.name,
        accountNumber,
        accountName: verifiedName!,
      }),
    onSuccess: (res) => {
      if (!res.success) setAddError(res.error)
      else {
        setAddOpen(false)
        setChosenBank(null)
        setAccountNumber("")
        setVerifiedName(null)
        setAddError(null)
        invalidate()
      }
    },
  })

  const removeBank = useMutation({
    mutationFn: (bankId: string) => deleteBankAction(bankId),
    onSuccess: () => invalidate(),
  })

  const withdraw = useMutation({
    mutationFn: () => withdrawNgn(amount, selectedBankId!),
    onSuccess: (res) => {
      if (!res.success) {
        setError(res.error === "kyc_required" ? "kyc_required" : res.error)
        setSuccessMsg(null)
      } else {
        setError(null)
        setAmount("")
        setSuccessMsg(
          `Withdrawal on its way — transfer fee ${fmtMoney(res.feeMinor, "NGN")} applies on top.`
        )
        invalidate()
      }
    },
  })

  const startKyc = useMutation({
    mutationFn: () => startKycAction(),
    onSuccess: (res) => {
      if (!res.success) setKycMsg(res.error ?? "Could not start verification")
      else if (res.alreadyVerified) {
        setKycMsg(null)
        invalidate()
      } else if (res.verificationUrl) {
        setKycSessionId(res.sessionId)
        window.open(res.verificationUrl, "_blank", "noopener")
      }
    },
  })

  const syncKyc = useMutation({
    mutationFn: () => syncKycAction(kycSessionId!),
    onSuccess: (res) => {
      if (!res.success) setKycMsg(res.error)
      else if (res.verification.verified) {
        setKycMsg(null)
        setKycSessionId(null)
        setError(null)
        invalidate()
      } else {
        setKycMsg("Verification not confirmed yet — finish the flow in the other tab, then check again.")
      }
    },
  })

  const kyc = overview?.kyc
  const kycBlocked = error === "kyc_required" || (kyc && !kyc.verified)
  const filteredDirectory = bankSearch
    ? directory.filter((b) => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
    : directory

  return (
    <>
      <Topbar />
      <div className="p-4 sm:p-6 space-y-5 pb-24 md:pb-6 max-w-2xl">
        <div>
          <h1 className="text-lg font-semibold">Withdraw</h1>
          <p className="text-sm text-muted-foreground">
            Send your NGN balance to any Nigerian bank account.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Available to withdraw</p>
                <p className="text-2xl font-semibold">{fmtMoney(overview?.ngn?.availableMinor ?? 0, "NGN")}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">USD balance</p>
                <p className="text-sm font-medium">{fmtMoney(overview?.usd?.availableMinor ?? 0, "USD")}</p>
                <p className="text-[10px] text-muted-foreground/70">USD payouts: coming soon</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KYC gate */}
        {kycBlocked && (
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={SecurityCheckIcon} size={16} className="text-orange-600" />
                <p className="text-xs font-semibold">Identity verification required for withdrawals</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                One-time check with a government ID (~2 minutes), powered by Didit.
              </p>
              {kycMsg && <p className="text-[11px] text-orange-600">{kycMsg}</p>}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" disabled={startKyc.isPending} onClick={() => startKyc.mutate()}>
                  {startKyc.isPending ? "Starting…" : kyc?.status === "in_progress" ? "Resume verification" : "Verify identity"}
                </Button>
                {kycSessionId && (
                  <Button size="sm" variant="ghost" disabled={syncKyc.isPending} onClick={() => syncKyc.mutate()}>
                    {syncKyc.isPending ? "Checking…" : "I've finished — check status"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Banks */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Destination bank</h2>
              <Button size="xs" variant="outline" onClick={() => setAddOpen(true)}>
                Add bank
              </Button>
            </div>
            {banksLoading ? (
              <Skeleton className="h-14 rounded-lg" />
            ) : savedBanks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No saved banks yet — add the account you want to receive payouts on.
              </p>
            ) : (
              <div className="space-y-1.5">
                {savedBanks.map((b) => (
                  <div
                    key={b.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                      selectedBankId === b.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                    onClick={() => setSelectedBankId(b.id)}
                  >
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <HugeiconsIcon icon={BankIcon} size={15} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{b.accountName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.bankName} · ····{b.accountNumber.slice(-4)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove bank"
                      className="text-muted-foreground/60 hover:text-destructive transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeBank.mutate(b.id)
                      }}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amount + submit */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Amount (NGN)</label>
              <Input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="10000"
              />
              <p className="text-[10px] text-muted-foreground">
                The recipient gets the full amount; the bank transfer fee is charged on top of it.
              </p>
            </div>
            {error && error !== "kyc_required" && <p className="text-xs text-destructive">{error}</p>}
            {successMsg && <p className="text-xs text-emerald-600">{successMsg}</p>}
            <Button
              className="w-full"
              disabled={!amount || !selectedBankId || withdraw.isPending}
              onClick={() => withdraw.mutate()}
            >
              {withdraw.isPending ? "Sending…" : "Withdraw"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Add bank dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setChosenBank(null); setVerifiedName(null); setAddError(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a bank account</DialogTitle>
            <DialogDescription>
              We verify the account name with the bank before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Bank picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Bank</label>
              {chosenBank ? (
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                  <span className="text-xs font-medium">{chosenBank.name}</span>
                  <Button size="xs" variant="ghost" onClick={() => { setChosenBank(null); setVerifiedName(null) }}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    placeholder="Search banks…"
                  />
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40">
                    {filteredDirectory.slice(0, 40).map((b) => (
                      <button
                        key={`${b.code}-${b.name}`}
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors"
                        onClick={() => setChosenBank({ code: b.code, name: b.name })}
                      >
                        {b.name}
                      </button>
                    ))}
                    {filteredDirectory.length === 0 && (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        {directory.length === 0 ? "Loading banks…" : "No match"}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Account number */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Account number</label>
              <Input
                inputMode="numeric"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))
                  setVerifiedName(null)
                }}
                placeholder="0123456789"
              />
            </div>

            {verifiedName && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{verifiedName}</p>
                <p className="text-[10px] text-muted-foreground">Account name confirmed by the bank</p>
              </div>
            )}
            {addError && <p className="text-xs text-destructive">{addError}</p>}
          </div>

          <DialogFooter>
            {!verifiedName ? (
              <Button
                size="sm"
                disabled={!chosenBank || accountNumber.length !== 10 || verify.isPending}
                onClick={() => verify.mutate()}
              >
                {verify.isPending ? "Verifying…" : "Verify account"}
              </Button>
            ) : (
              <Button size="sm" disabled={addBank.isPending} onClick={() => addBank.mutate()}>
                {addBank.isPending ? "Saving…" : "Save bank"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
