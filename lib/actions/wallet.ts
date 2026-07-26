"use server"

import { randomUUID } from "crypto"
import { getCurrentUser } from "@/lib/auth/actions"
import { notifyUser } from "@/lib/notify"
import connectDB from "@/lib/db"
import {
  walletEnabled,
  WalletError,
  getWalletBalances,
  getDollarAccount,
  listDollarDeposits,
  initiateDollarDeposit,
  syncDollarDeposit,
  getFiatWallet,
  listFiatDeposits,
  initiateFiatDeposit,
  syncFiatDeposit,
  listFiatWithdrawals,
  initiateFiatWithdrawal,
  provisionPayoutSubaccount,
  listNgnBankDirectory,
  listSavedBanks,
  verifyBankAccount,
  addBankAccount,
  deleteBankAccount,
  getIdentityStatus,
  startKycSession,
  syncKycSession,
  listUserCharges,
  type WalletActor,
  type DollarAccountSummary,
  type FiatWalletSummary,
  type FiatSavedBankAccount,
  type FlutterwaveBank,
  type IdentityVerificationSummary,
} from "@/lib/wallet"

/* ── Legacy checkout balance read (kept for the checkout page) ── */

export type MyWalletBalance = {
  enabled: boolean
  usdAvailableMinor: number
  usdAvailable: number
  /** In-academy funding page (external override via NEXT_PUBLIC_WALLET_FUNDING_URL). */
  fundingUrl: string
}

const FUNDING_URL = process.env.NEXT_PUBLIC_WALLET_FUNDING_URL || "/dashboard/wallet/deposit"

export async function getMyWalletBalance(): Promise<MyWalletBalance> {
  const base: MyWalletBalance = {
    enabled: false,
    usdAvailableMinor: 0,
    usdAvailable: 0,
    fundingUrl: FUNDING_URL,
  }
  try {
    const user = await getCurrentUser()
    if (!user || !walletEnabled()) return base
    const balances = await getWalletBalances(user.authUserId)
    return {
      enabled: true,
      usdAvailableMinor: balances.USD.availableMinor,
      usdAvailable: balances.USD.available,
      fundingUrl: FUNDING_URL,
    }
  } catch (err) {
    console.error("[Wallet] balance read failed:", err)
    return base
  }
}

/* ── Shared plumbing ── */

type ActionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

async function walletUser(): Promise<ActionUser | null> {
  const user = await getCurrentUser()
  if (!user || !walletEnabled()) return null
  return user
}

function actorOf(user: ActionUser): WalletActor {
  return {
    email: user.email || undefined,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
  }
}

function friendlyWalletError(err: unknown, fallback: string): string {
  if (err instanceof WalletError) {
    switch (err.code) {
      case "WALLET_DISABLED":
      case "WALLET_UNAVAILABLE":
        return "The wallet service is unreachable right now — try again shortly."
      case "INSUFFICIENT_BALANCE":
        return "Insufficient balance."
      case "PROFILE_NAME_REQUIRED":
        return "Add your first and last name to your profile first — the payment provider requires a full name."
      default:
        return err.message || fallback
    }
  }
  return fallback
}

/* ── Overview ── */

export type WalletOverview = {
  enabled: boolean
  usd: DollarAccountSummary | null
  ngn: FiatWalletSummary | null
  kyc: IdentityVerificationSummary | null
}

export async function getMyWalletOverview(): Promise<WalletOverview> {
  const base: WalletOverview = { enabled: false, usd: null, ngn: null, kyc: null }
  try {
    const user = await walletUser()
    if (!user) return base

    const [usd, ngn, kyc] = await Promise.allSettled([
      getDollarAccount(user.authUserId),
      getFiatWallet(user.authUserId, actorOf(user)),
      getIdentityStatus(user.authUserId),
    ])

    return {
      enabled: true,
      usd: usd.status === "fulfilled" ? usd.value : null,
      ngn: ngn.status === "fulfilled" ? ngn.value : null,
      kyc: kyc.status === "fulfilled" ? kyc.value : null,
    }
  } catch (err) {
    console.error("[Wallet] overview failed:", err)
    return base
  }
}

/* ── Unified transaction feed ── */

export type WalletTxKind = "deposit_usd" | "deposit_ngn" | "withdrawal_ngn" | "purchase" | "refund"
export type WalletTxStatus = "completed" | "pending" | "failed" | "review"

export type WalletTxItem = {
  id: string
  kind: WalletTxKind
  title: string
  detail: string
  /** Positive = money in, negative = money out (in that currency's minor unit). */
  signedMinor: number
  currency: "USD" | "NGN"
  status: WalletTxStatus
  createdAt: string
  /** For pending hosted-checkout deposits — lets the UI offer "I've paid → sync". */
  txRef?: string
  checkoutUrl?: string
}

const DEPOSIT_STATUS: Record<string, WalletTxStatus> = {
  available: "completed",
  credited: "completed",
  credited_pending_settlement: "pending",
  pending: "pending",
  processing: "pending",
  failed: "failed",
  review: "review",
}

const WITHDRAWAL_STATUS: Record<string, WalletTxStatus> = {
  successful: "completed",
  pending: "pending",
  processing: "pending",
  failed: "failed",
  reversed: "failed",
  review: "review",
}

export async function getMyWalletTransactions(): Promise<{ enabled: boolean; items: WalletTxItem[] }> {
  try {
    const user = await walletUser()
    if (!user) return { enabled: false, items: [] }

    const [usdDeps, ngnDeps, ngnWds, charges] = await Promise.allSettled([
      listDollarDeposits(user.authUserId, 20),
      listFiatDeposits(user.authUserId, 20),
      listFiatWithdrawals(user.authUserId, 20),
      listUserCharges(user.authUserId, 30),
    ])

    const items: WalletTxItem[] = []

    if (usdDeps.status === "fulfilled") {
      for (const d of usdDeps.value) {
        items.push({
          id: `dusd_${d.id}`,
          kind: "deposit_usd",
          title: "USD deposit",
          detail:
            d.chargedCurrency === "NGN"
              ? `Funded with NGN at ₦${d.fxRate.toLocaleString()} / $`
              : "Card / hosted checkout",
          signedMinor: d.amountMinor,
          currency: "USD",
          status: DEPOSIT_STATUS[d.status] ?? "pending",
          createdAt: d.createdAt,
          txRef: d.txRef,
          checkoutUrl: d.checkoutUrl || undefined,
        })
      }
    }
    if (ngnDeps.status === "fulfilled") {
      for (const d of ngnDeps.value) {
        items.push({
          id: `dngn_${d.id}`,
          kind: "deposit_ngn",
          title: "NGN deposit",
          detail: d.source === "flutterwave_virtual_account" ? "Bank transfer" : "Hosted checkout",
          signedMinor: d.amountMinor,
          currency: "NGN",
          status: DEPOSIT_STATUS[d.status] ?? "pending",
          createdAt: d.createdAt,
          txRef: d.txRef,
        })
      }
    }
    if (ngnWds.status === "fulfilled") {
      for (const w of ngnWds.value) {
        items.push({
          id: `wngn_${w.id}`,
          kind: "withdrawal_ngn",
          title: "NGN withdrawal",
          detail: `${w.bankName} ····${w.accountNumber.slice(-4)}`,
          signedMinor: -(w.amountMinor + w.feeMinor),
          currency: "NGN",
          status: WITHDRAWAL_STATUS[w.status] ?? "pending",
          createdAt: w.createdAt,
        })
      }
    }
    if (charges.status === "fulfilled") {
      for (const c of charges.value) {
        if (c.status === "refunded") {
          items.push({
            id: `rf_${c.id}`,
            kind: "refund",
            title: "Refund",
            detail: c.description || "Purchase refunded",
            signedMinor: c.amountMinor,
            currency: "USD",
            status: "completed",
            createdAt: c.refundedAt || c.createdAt,
          })
        }
        items.push({
          id: `ch_${c.id}`,
          kind: "purchase",
          title: "Purchase",
          detail: c.description || "Platform purchase",
          signedMinor: -c.amountMinor,
          currency: "USD",
          status: "completed",
          createdAt: c.createdAt,
        })
      }
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return { enabled: true, items }
  } catch (err) {
    console.error("[Wallet] transactions failed:", err)
    return { enabled: false, items: [] }
  }
}

/* ── Deposits ── */

export async function startDollarDeposit(amountUsd: string, fundingCurrency: "USD" | "NGN") {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }

    const amount = Number(amountUsd)
    if (!Number.isFinite(amount) || amount < 1) {
      return { success: false as const, error: "Minimum deposit is $1.00" }
    }

    const r = await initiateDollarDeposit(
      user.authUserId,
      amount.toFixed(2),
      fundingCurrency,
      actorOf(user),
      randomUUID()
    )
    return { success: true as const, checkoutUrl: r.checkoutUrl, txRef: r.txRef }
  } catch (err) {
    console.error("[Wallet] start USD deposit failed:", err)
    return { success: false as const, error: friendlyWalletError(err, "Could not start the deposit") }
  }
}

export async function syncDollarDepositAction(txRef: string) {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }

    const r = await syncDollarDeposit(user.authUserId, txRef, randomUUID())
    if (r.status === "available" || r.status === "credited_pending_settlement") {
      await connectDB()
      void notifyUser(user.id, {
        type: "payment",
        title: "Deposit credited 🎉",
        body: "Your USD deposit has landed in your Worldstreet balance.",
        href: "/dashboard/wallet",
      })
    }
    return { success: true as const, status: r.status, availableMinor: r.account.availableMinor }
  } catch (err) {
    return { success: false as const, error: friendlyWalletError(err, "Could not confirm the deposit yet") }
  }
}

export async function startFiatDeposit(amountNgn: string) {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }

    const amount = Number(amountNgn)
    if (!Number.isFinite(amount) || amount < 100) {
      return { success: false as const, error: "Minimum deposit is ₦100" }
    }

    const r = await initiateFiatDeposit(user.authUserId, amount.toFixed(2), actorOf(user), randomUUID())
    return { success: true as const, checkoutUrl: r.checkoutUrl, txRef: r.txRef }
  } catch (err) {
    console.error("[Wallet] start NGN deposit failed:", err)
    return { success: false as const, error: friendlyWalletError(err, "Could not start the deposit") }
  }
}

export async function syncFiatDepositAction(txRef: string) {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }
    const r = await syncFiatDeposit(user.authUserId, txRef, randomUUID())
    return { success: true as const, status: r.status, availableMinor: r.wallet.availableMinor }
  } catch (err) {
    return { success: false as const, error: friendlyWalletError(err, "Could not confirm the deposit yet") }
  }
}

export async function provisionPayoutSubaccountAction() {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }
    const wallet = await provisionPayoutSubaccount(user.authUserId, actorOf(user), randomUUID())
    return { success: true as const, wallet }
  } catch (err) {
    console.error("[Wallet] provision subaccount failed:", err)
    return { success: false as const, error: friendlyWalletError(err, "Could not create your funding account") }
  }
}

/* ── Banks + withdrawals ── */

export async function getNgnBanks(): Promise<FlutterwaveBank[]> {
  try {
    const user = await walletUser()
    if (!user) return []
    return await listNgnBankDirectory(user.authUserId)
  } catch {
    return []
  }
}

export async function getMySavedBanks(): Promise<FiatSavedBankAccount[]> {
  try {
    const user = await walletUser()
    if (!user) return []
    return await listSavedBanks(user.authUserId)
  } catch {
    return []
  }
}

export async function verifyBankAction(bankCode: string, bankName: string, accountNumber: string) {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }
    if (!/^\d{10}$/.test(accountNumber.trim())) {
      return { success: false as const, error: "Account number must be 10 digits" }
    }
    const bank = await verifyBankAccount(
      user.authUserId,
      { bankCode, bankName, accountNumber: accountNumber.trim() },
      randomUUID()
    )
    return { success: true as const, accountName: bank.accountName }
  } catch (err) {
    return { success: false as const, error: friendlyWalletError(err, "Could not verify that account") }
  }
}

export async function addBankAction(input: {
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
}) {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }
    const banks = await addBankAccount(user.authUserId, input, randomUUID())
    return { success: true as const, banks }
  } catch (err) {
    return { success: false as const, error: friendlyWalletError(err, "Could not save the bank account") }
  }
}

export async function deleteBankAction(bankId: string) {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }
    const banks = await deleteBankAccount(user.authUserId, bankId, randomUUID())
    return { success: true as const, banks }
  } catch (err) {
    return { success: false as const, error: friendlyWalletError(err, "Could not remove the bank account") }
  }
}

export async function withdrawNgn(amountNgn: string, bankId: string) {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }

    const amount = Number(amountNgn)
    if (!Number.isFinite(amount) || amount < 100) {
      return { success: false as const, error: "Minimum withdrawal is ₦100" }
    }

    // KYC gate — payouts require a verified identity (enforced here; the
    // central dashboard enforces the same rule on its own withdrawal UI).
    const kyc = await getIdentityStatus(user.authUserId).catch(() => null)
    if (!kyc?.verified) {
      return { success: false as const, error: "kyc_required" }
    }

    const r = await initiateFiatWithdrawal(
      user.authUserId,
      amount.toFixed(2),
      bankId,
      actorOf(user),
      randomUUID()
    )

    await connectDB()
    void notifyUser(user.id, {
      type: "payment",
      title: "Withdrawal initiated",
      body: `₦${amount.toLocaleString()} to ${r.withdrawal.bankName} ····${r.withdrawal.accountNumber.slice(-4)}`,
      href: "/dashboard/wallet",
    })

    return {
      success: true as const,
      status: r.withdrawal.status,
      feeMinor: r.withdrawal.feeMinor,
      availableMinor: r.wallet.availableMinor,
    }
  } catch (err) {
    console.error("[Wallet] NGN withdrawal failed:", err)
    return { success: false as const, error: friendlyWalletError(err, "Withdrawal failed — nothing was debited") }
  }
}

/* ── KYC ── */

export async function getKycStatusAction(): Promise<IdentityVerificationSummary | null> {
  try {
    const user = await walletUser()
    if (!user) return null
    return await getIdentityStatus(user.authUserId)
  } catch {
    return null
  }
}

export async function startKycAction() {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }
    const session = await startKycSession(user.authUserId, actorOf(user), randomUUID(), "/dashboard/wallet")
    return {
      success: true as const,
      alreadyVerified: session.alreadyVerified,
      verificationUrl: session.verificationUrl,
      sessionId: session.sessionId,
    }
  } catch (err) {
    return { success: false as const, error: friendlyWalletError(err, "Could not start verification") }
  }
}

export async function syncKycAction(sessionId: string) {
  try {
    const user = await walletUser()
    if (!user) return { success: false as const, error: "Wallet unavailable" }
    const verification = await syncKycSession(user.authUserId, sessionId, randomUUID())
    return { success: true as const, verification }
  } catch (err) {
    return { success: false as const, error: friendlyWalletError(err, "Could not confirm verification yet") }
  }
}
