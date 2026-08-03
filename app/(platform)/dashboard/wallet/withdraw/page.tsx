"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
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
import { Landmark, ShieldCheck, Trash2, Plus } from "lucide-react"
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
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="">
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
              Withdraw
            </h1>
            <p className="mt-1 text-[15px] text-ws-muted">
              Send your NGN balance to any Nigerian bank account.
            </p>
          </div>

          {isLoading ? (
            <Skeleton className="h-36 rounded-lg" />
          ) : (
            <section className="rounded-lg border border-ws-hairline bg-ws-surface p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">
                Available to withdraw
              </p>
              <p className="mt-2 font-display text-4xl font-semibold tabular-nums tracking-[-0.02em] text-ws-primary">
                {fmtMoney(overview?.ngn?.availableMinor ?? 0, "NGN")}
              </p>
              <div className="mt-5 flex items-center justify-between gap-4 border-t border-ws-hairline pt-4 text-[13px]">
                <span className="text-ws-muted">USD balance · payouts coming soon</span>
                <span className="font-semibold tabular-nums text-ws-primary">
                  {fmtMoney(overview?.usd?.availableMinor ?? 0, "USD")}
                </span>
              </div>
            </section>
          )}

          {/* KYC gate */}
          {kycBlocked && (
            <section className="rounded-lg border border-ws-hairline bg-ws-surface p-5">
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
                  <ShieldCheck size={18} strokeWidth={2} className="text-ws-gold" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ws-primary">
                    Identity verification required for withdrawals
                  </p>
                  <p className="text-[13px] text-ws-muted">
                    One-time check with a government ID (~2 minutes), powered by Didit.
                  </p>
                </div>
              </div>
              {kycMsg && <p className="mt-2 text-[13px] text-ws-gold">{kycMsg}</p>}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={startKyc.isPending}
                  onClick={() => startKyc.mutate()}
                  className="h-9 rounded-sm border border-ws-hairline px-4 text-[13px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised disabled:pointer-events-none disabled:opacity-50"
                >
                  {startKyc.isPending ? "Starting…" : kyc?.status === "in_progress" ? "Resume verification" : "Verify identity"}
                </button>
                {kycSessionId && (
                  <button
                    type="button"
                    disabled={syncKyc.isPending}
                    onClick={() => syncKyc.mutate()}
                    className="h-9 rounded-sm px-4 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary disabled:pointer-events-none disabled:opacity-50"
                  >
                    {syncKyc.isPending ? "Checking…" : "I've finished — check status"}
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Banks */}
          <section className="rounded-lg border border-ws-hairline bg-ws-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ws-primary">Destination bank</h2>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ws-hairline px-3 text-xs font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"
              >
                <Plus size={13} strokeWidth={2} aria-hidden />
                Add bank
              </button>
            </div>
            {banksLoading ? (
              <Skeleton className="mt-3 h-14 rounded-md" />
            ) : savedBanks.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-ws-muted">
                No saved banks yet — add the account you want to receive payouts on.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {savedBanks.map((b) => (
                  <div
                    key={b.id}
                    className={`flex min-h-14 cursor-pointer items-center gap-3.5 rounded-md border px-3.5 py-2.5 transition-colors duration-[var(--ws-motion-fast)] ${
                      selectedBankId === b.id
                        ? "border-ws-brand bg-ws-brand/5"
                        : "border-ws-hairline hover:bg-ws-raised/60"
                    }`}
                    onClick={() => setSelectedBankId(b.id)}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
                      <Landmark size={17} strokeWidth={2} className="text-ws-muted" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ws-primary">{b.accountName}</p>
                      <p className="text-[13px] tabular-nums text-ws-muted">
                        {b.bankName} · ····{b.accountNumber.slice(-4)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove bank"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ws-subtle transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeBank.mutate(b.id)
                      }}
                    >
                      <Trash2 size={14} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Amount + submit */}
          <section className="space-y-5 rounded-lg border border-ws-hairline bg-ws-surface p-6">
            <div className="space-y-4">
              <label
                htmlFor="withdraw-amount"
                className="block text-center text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted"
              >
                Amount (NGN)
              </label>
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-display text-2xl font-medium text-ws-muted">₦</span>
                <input
                  id="withdraw-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="0"
                  size={Math.max(amount.length, 4)}
                  className="min-w-0 bg-transparent text-center font-display text-4xl font-semibold tabular-nums text-ws-primary outline-none [field-sizing:content] placeholder:text-ws-subtle"
                />
              </div>
              <p className="text-center text-xs text-ws-subtle">
                The recipient gets the full amount; the bank transfer fee is charged on top of it.
              </p>
            </div>
            {error && error !== "kyc_required" && (
              <p className="text-center text-[13px] text-ws-danger">{error}</p>
            )}
            {successMsg && <p className="text-center text-[13px] text-ws-success">{successMsg}</p>}
            <button
              type="button"
              disabled={!amount || !selectedBankId || withdraw.isPending}
              onClick={() => withdraw.mutate()}
              className="h-[52px] w-full rounded-sm bg-ws-brand text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              {withdraw.isPending ? "Sending…" : "Withdraw"}
            </button>
          </section>
        </div>
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

          <div className="space-y-4">
            {/* Bank picker */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ws-primary">Bank</label>
              {chosenBank ? (
                <div className="flex items-center justify-between rounded-md border border-ws-hairline px-3.5 py-2.5">
                  <span className="text-[13px] font-medium text-ws-primary">{chosenBank.name}</span>
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
                  <div className="max-h-40 divide-y divide-ws-hairline overflow-y-auto rounded-md border border-ws-hairline">
                    {filteredDirectory.slice(0, 40).map((b) => (
                      <button
                        key={`${b.code}-${b.name}`}
                        type="button"
                        className="w-full px-3.5 py-2.5 text-left text-[13px] text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                        onClick={() => setChosenBank({ code: b.code, name: b.name })}
                      >
                        {b.name}
                      </button>
                    ))}
                    {filteredDirectory.length === 0 && (
                      <p className="px-3 py-4 text-center text-[13px] text-ws-muted">
                        {directory.length === 0 ? "Loading banks…" : "No match"}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Account number */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ws-primary">Account number</label>
              <Input
                inputMode="numeric"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))
                  setVerifiedName(null)
                }}
                placeholder="0123456789"
                className="tabular-nums"
              />
            </div>

            {verifiedName && (
              <div className="rounded-md border border-ws-success/25 bg-ws-success/10 px-3.5 py-2.5">
                <p className="text-[13px] font-semibold text-ws-success">{verifiedName}</p>
                <p className="text-xs text-ws-muted">Account name confirmed by the bank</p>
              </div>
            )}
            {addError && <p className="text-[13px] text-ws-danger">{addError}</p>}
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
