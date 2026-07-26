import "server-only"

/**
 * Client for the central Worldstreet Wallet service (worldstreet-wallet).
 *
 * The wallet is the single source of truth for every user's spendable balance
 * across the Worldstreet ecosystem. The Academy never holds a balance of its
 * own: it reads balances, requests debits (charges), and requests refunds /
 * payout credits — all server-to-server with the `academy` branch service
 * token. Amounts are integer US cents ("minor units").
 *
 * Env:
 *   WALLET_BASE_URL       e.g. https://wallet-api.worldstreetgold.com
 *   WALLET_SERVICE_TOKEN  the academy branch token (registered on the wallet
 *                         as `academy:<token>` in WALLET_SERVICE_TOKENS)
 *
 * When either is missing the wallet is "disabled" and every money operation
 * fails closed — paid enrollment must never succeed without a confirmed debit.
 */

const BASE_URL = process.env.WALLET_BASE_URL?.replace(/\/+$/, "") ?? ""
const SERVICE_TOKEN = process.env.WALLET_SERVICE_TOKEN ?? ""

export function walletEnabled(): boolean {
  return Boolean(BASE_URL && SERVICE_TOKEN)
}

export class WalletError extends Error {
  code: string
  status: number
  details: Record<string, unknown>

  constructor(code: string, status: number, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = "WalletError"
    this.code = code
    this.status = status
    this.details = details
  }
}

export function isInsufficientBalance(err: unknown): err is WalletError {
  return err instanceof WalletError && err.code === "INSUFFICIENT_BALANCE"
}

export type WalletBalance = {
  availableMinor: number
  lockedMinor: number
  available: number
  locked: number
}

export type WalletBalances = { USD: WalletBalance; NGN: WalletBalance }

export type WalletCharge = {
  id: string
  chargeRef: string
  status: "succeeded" | "refunded"
  currency: "USD"
  amountMinor: number
  recipientAmountMinor: number
  platformRevenueMinor: number
  description: string
  createdAt: string
  refundedAt?: string
}

type WalletRequest = {
  method: "GET" | "POST" | "DELETE"
  path: string
  body?: Record<string, unknown>
  idempotencyKey?: string
  /** Query params (service-principal GETs forward the actor identity this way). */
  query?: Record<string, string | number | undefined>
}

async function walletFetch<T>({ method, path, body, idempotencyKey, query }: WalletRequest): Promise<T> {
  if (!walletEnabled()) {
    throw new WalletError("WALLET_DISABLED", 503, "Wallet service is not configured")
  }

  const headers: Record<string, string> = {
    "X-Wallet-Service-Token": SERVICE_TOKEN,
    "Content-Type": "application/json",
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey

  let qs = ""
  if (query) {
    const search = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") search.set(k, String(v))
    }
    const s = search.toString()
    if (s) qs = `?${s}`
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}${qs}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    // Network failure / timeout — fail closed, never assume the money moved.
    throw new WalletError(
      "WALLET_UNAVAILABLE",
      502,
      `Wallet service unreachable: ${err instanceof Error ? err.message : "unknown error"}`
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = (await res.json()) as Record<string, unknown>
  } catch {
    throw new WalletError("WALLET_UNAVAILABLE", 502, `Wallet returned a non-JSON response (HTTP ${res.status})`)
  }

  if (!res.ok || payload.ok === false) {
    const code = typeof payload.code === "string" ? payload.code : "WALLET_ERROR"
    const message = typeof payload.error === "string" ? payload.error : `Wallet request failed (HTTP ${res.status})`
    throw new WalletError(code, res.status, message, payload)
  }

  return payload as T
}

/** Pooled USD + NGN balances for a user (`:userId` = Clerk authUserId). */
export async function getWalletBalances(authUserId: string): Promise<WalletBalances> {
  const data = await walletFetch<{ ok: true } & Record<string, unknown>>({
    method: "GET",
    path: `/v1/wallet/${encodeURIComponent(authUserId)}/balances`,
  })
  const balances = (data.balances ?? data) as Record<string, WalletBalance>
  const zero: WalletBalance = { availableMinor: 0, lockedMinor: 0, available: 0, locked: 0 }
  return { USD: balances.USD ?? zero, NGN: balances.NGN ?? zero }
}

/**
 * Instant debit of the spender's USD balance. Idempotent: pass a deterministic
 * `idempotencyKey` per business action (we key on user+course) so a retried or
 * double-clicked purchase can never debit twice.
 * Throws WalletError INSUFFICIENT_BALANCE (409) when funds don't cover it.
 */
export async function createWalletCharge(
  authUserId: string,
  input: {
    amountMinor: number
    description: string
    metadata?: Record<string, unknown>
    idempotencyKey: string
  }
): Promise<{ charge: WalletCharge; balances?: WalletBalances }> {
  const data = await walletFetch<{ ok: true; charge: WalletCharge; account?: WalletBalances }>({
    method: "POST",
    path: `/v1/wallet/${encodeURIComponent(authUserId)}/charges`,
    idempotencyKey: input.idempotencyKey,
    body: {
      amountMinor: input.amountMinor,
      currency: "USD",
      description: input.description,
      metadata: input.metadata ?? {},
    },
  })
  return { charge: data.charge, balances: data.account }
}

/** Full refund of a prior charge (safe to call twice — replays are no-ops). */
export async function refundWalletCharge(
  authUserId: string,
  chargeId: string,
  reason: string
): Promise<WalletCharge> {
  const data = await walletFetch<{ ok: true; charge: WalletCharge }>({
    method: "POST",
    path: `/v1/wallet/${encodeURIComponent(authUserId)}/charges/${encodeURIComponent(chargeId)}/refund`,
    idempotencyKey: `academy_refund_${chargeId}`,
    body: { reason },
  })
  return data.charge
}

/**
 * Platform → user payout credit (instructor earnings clearing). The wallet
 * dedupes on `(platform, reference)`, so a deterministic reference makes this
 * idempotent: crediting the same earning twice is a no-op.
 */
export async function createWalletCredit(
  authUserId: string,
  input: {
    amountMinor: number
    reference: string
    description: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await walletFetch<{ ok: true }>({
    method: "POST",
    path: `/v1/wallet/${encodeURIComponent(authUserId)}/credits`,
    idempotencyKey: input.reference,
    body: {
      amountMinor: input.amountMinor,
      currency: "USD",
      reference: input.reference,
      description: input.description,
      metadata: input.metadata ?? {},
    },
  })
}

/** Look up a single charge (reconciliation). */
export async function getWalletCharge(authUserId: string, chargeId: string): Promise<WalletCharge> {
  const data = await walletFetch<{ ok: true; charge: WalletCharge }>({
    method: "GET",
    path: `/v1/wallet/${encodeURIComponent(authUserId)}/charges/${encodeURIComponent(chargeId)}`,
  })
  return data.charge
}

/* ════════════════════════════════════════════════════════════════════════════
 * User-scope wallet surface (WA Phase 4) — the same endpoints the mobile app
 * consumes, proxied server-side with the service token. Because our principal
 * is the service, actor identity is forwarded explicitly: `body.actor` on
 * POSTs, flat query params (email/firstName/lastName) on GETs that touch
 * Flutterwave (see wallet repo src/http/request.ts).
 * ════════════════════════════════════════════════════════════════════════════ */

export type WalletActor = {
  email?: string
  firstName?: string
  lastName?: string
}

export type DollarAccountSummary = {
  currency: "USD"
  availableMinor: number
  lockedMinor: number
  pendingSettlementMinor: number
  available: number
  locked: number
  pendingSettlement: number
}

export type DollarDepositHistoryItem = {
  id: string
  txRef: string
  amountMinor: number
  amount: number
  chargedCurrency: "USD" | "NGN"
  chargedAmountMinor: number
  chargedAmount: number
  fxRate: number
  status: "pending" | "processing" | "credited_pending_settlement" | "available" | "failed" | "review"
  checkoutUrl: string
  failureReason: string
  createdAt: string
  creditedAt: string | null
}

export type FiatPayoutSubaccountSummary = {
  accountReference: string
  accountName: string
  accountNumber: string
  bankName: string
  bankCode: string
  currency: "NGN"
  status: string
}

export type FiatWalletSummary = {
  currency: "NGN"
  availableMinor: number
  lockedMinor: number
  available: number
  locked: number
  balanceSource: "payout_subaccount" | "local_ledger"
  hasVirtualAccount: boolean
  hasPayoutSubaccount: boolean
  payoutSubaccount: FiatPayoutSubaccountSummary | null
  canCreateVirtualAccount: boolean
  missingProfileName: boolean
}

export type FiatDepositHistoryItem = {
  id: string
  txRef: string
  currency: "NGN"
  amountMinor: number
  amount: number
  status: "pending" | "processing" | "credited" | "failed" | "review"
  source: string
  failureReason: string
  createdAt: string
  creditedAt: string | null
}

export type FiatWithdrawalHistoryItem = {
  id: string
  txRef: string
  currency: "NGN"
  amountMinor: number
  amount: number
  feeMinor: number
  fee: number
  status: "pending" | "processing" | "successful" | "failed" | "reversed" | "review"
  bankName: string
  accountNumber: string
  accountName: string
  failureReason: string
  createdAt: string
  completedAt: string | null
}

export type FiatSavedBankAccount = {
  id: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  isDefault: boolean
}

export type FlutterwaveBank = { code: string; name: string }

export type KycStatus =
  | "not_started"
  | "in_progress"
  | "in_review"
  | "approved"
  | "declined"
  | "abandoned"
  | "expired"

export type IdentityVerificationSummary = {
  verified: boolean
  status: KycStatus
  sessionId: string | null
  verificationUrl: string | null
  updatedAt: string | null
}

export type KycSession = {
  sessionId: string
  verificationUrl: string
  status: KycStatus
  alreadyVerified: boolean
}

export type UserChargeItem = {
  id: string
  status: "succeeded" | "refunded"
  amountMinor: number
  description: string
  createdAt: string
  refundedAt?: string
  metadata?: Record<string, unknown>
}

const userBase = (authUserId: string) => `/v1/wallet/${encodeURIComponent(authUserId)}`

// ── Dollar (USD) ──

export async function getDollarAccount(authUserId: string): Promise<DollarAccountSummary> {
  const r = await walletFetch<{ ok: true; account: DollarAccountSummary }>({
    method: "GET",
    path: `${userBase(authUserId)}/dollar/account`,
  })
  return r.account
}

export async function listDollarDeposits(authUserId: string, limit = 12): Promise<DollarDepositHistoryItem[]> {
  const r = await walletFetch<{ ok: true; deposits: DollarDepositHistoryItem[] }>({
    method: "GET",
    path: `${userBase(authUserId)}/dollar/deposits`,
    query: { limit },
  })
  return r.deposits
}

/** Hosted checkout — caller opens `checkoutUrl`, then syncs the txRef on return. */
export async function initiateDollarDeposit(
  authUserId: string,
  amount: string,
  fundingCurrency: "USD" | "NGN",
  actor: WalletActor,
  idempotencyKey: string
): Promise<{ checkoutUrl: string; txRef: string }> {
  return walletFetch<{ ok: true; checkoutUrl: string; txRef: string }>({
    method: "POST",
    path: `${userBase(authUserId)}/dollar/deposits`,
    idempotencyKey,
    body: { amount, fundingCurrency, actor },
  })
}

export async function syncDollarDeposit(authUserId: string, txRef: string, idempotencyKey: string) {
  return walletFetch<{ ok: true; account: DollarAccountSummary; status: DollarDepositHistoryItem["status"] }>({
    method: "POST",
    path: `${userBase(authUserId)}/dollar/deposits/${encodeURIComponent(txRef)}/sync`,
    idempotencyKey,
  })
}

// ── Fiat (NGN) ──

export async function getFiatWallet(authUserId: string, actor: WalletActor): Promise<FiatWalletSummary> {
  const r = await walletFetch<{ ok: true; wallet: FiatWalletSummary }>({
    method: "GET",
    path: `${userBase(authUserId)}/fiat/wallet`,
    // Service-principal GETs forward the actor as flat query params.
    query: { email: actor.email, firstName: actor.firstName, lastName: actor.lastName },
  })
  return r.wallet
}

export async function listFiatDeposits(authUserId: string, limit = 12): Promise<FiatDepositHistoryItem[]> {
  const r = await walletFetch<{ ok: true; deposits: FiatDepositHistoryItem[] }>({
    method: "GET",
    path: `${userBase(authUserId)}/fiat/deposits`,
    query: { limit },
  })
  return r.deposits
}

export async function initiateFiatDeposit(
  authUserId: string,
  amount: string,
  actor: WalletActor,
  idempotencyKey: string
): Promise<{ checkoutUrl: string; txRef: string; walletAmount: number }> {
  return walletFetch<{ ok: true; checkoutUrl: string; txRef: string; walletAmount: number }>({
    method: "POST",
    path: `${userBase(authUserId)}/fiat/deposits`,
    idempotencyKey,
    body: { amount, actor },
  })
}

export async function syncFiatDeposit(authUserId: string, txRef: string, idempotencyKey: string) {
  return walletFetch<{ ok: true; wallet: FiatWalletSummary; status: FiatDepositHistoryItem["status"] }>({
    method: "POST",
    path: `${userBase(authUserId)}/fiat/deposits/${encodeURIComponent(txRef)}/sync`,
    idempotencyKey,
  })
}

export async function listFiatWithdrawals(authUserId: string, limit = 12): Promise<FiatWithdrawalHistoryItem[]> {
  const r = await walletFetch<{ ok: true; withdrawals: FiatWithdrawalHistoryItem[] }>({
    method: "GET",
    path: `${userBase(authUserId)}/fiat/withdrawals`,
    query: { limit },
  })
  return r.withdrawals
}

export async function initiateFiatWithdrawal(
  authUserId: string,
  amount: string,
  bankId: string,
  actor: WalletActor,
  idempotencyKey: string
): Promise<{ withdrawal: FiatWithdrawalHistoryItem; wallet: FiatWalletSummary }> {
  return walletFetch<{ ok: true; withdrawal: FiatWithdrawalHistoryItem; wallet: FiatWalletSummary }>({
    method: "POST",
    path: `${userBase(authUserId)}/fiat/withdrawals`,
    idempotencyKey,
    body: { amount, bankId, actor },
  })
}

export async function provisionPayoutSubaccount(
  authUserId: string,
  actor: WalletActor,
  idempotencyKey: string
): Promise<FiatWalletSummary> {
  const r = await walletFetch<{ ok: true; wallet: FiatWalletSummary }>({
    method: "POST",
    path: `${userBase(authUserId)}/fiat/payout-subaccount`,
    idempotencyKey,
    body: { actor },
  })
  return r.wallet
}

// ── Banks ──

export async function listNgnBankDirectory(authUserId: string): Promise<FlutterwaveBank[]> {
  const r = await walletFetch<{ ok: true; banks: FlutterwaveBank[] }>({
    method: "GET",
    path: `${userBase(authUserId)}/fiat/banks/list`,
  })
  return r.banks
}

export async function listSavedBanks(authUserId: string): Promise<FiatSavedBankAccount[]> {
  const r = await walletFetch<{ ok: true; bankAccounts: FiatSavedBankAccount[] }>({
    method: "GET",
    path: `${userBase(authUserId)}/fiat/banks`,
  })
  return r.bankAccounts
}

export async function verifyBankAccount(
  authUserId: string,
  bank: { bankCode: string; bankName: string; accountNumber: string },
  idempotencyKey: string
): Promise<{ bankCode: string; bankName: string; accountNumber: string; accountName: string }> {
  const r = await walletFetch<{
    ok: true
    bank: { bankCode: string; bankName: string; accountNumber: string; accountName: string }
  }>({
    method: "POST",
    path: `${userBase(authUserId)}/fiat/banks/verify`,
    idempotencyKey,
    body: bank,
  })
  return r.bank
}

export async function addBankAccount(
  authUserId: string,
  bank: { bankCode: string; bankName: string; accountNumber: string; accountName: string },
  idempotencyKey: string
): Promise<FiatSavedBankAccount[]> {
  const r = await walletFetch<{ ok: true; bankAccounts: FiatSavedBankAccount[] }>({
    method: "POST",
    path: `${userBase(authUserId)}/fiat/banks`,
    idempotencyKey,
    body: bank,
  })
  return r.bankAccounts
}

export async function deleteBankAccount(
  authUserId: string,
  bankId: string,
  idempotencyKey: string
): Promise<FiatSavedBankAccount[]> {
  const r = await walletFetch<{ ok: true; bankAccounts: FiatSavedBankAccount[] }>({
    method: "DELETE",
    path: `${userBase(authUserId)}/fiat/banks/${encodeURIComponent(bankId)}`,
    idempotencyKey,
  })
  return r.bankAccounts
}

// ── Identity / KYC ──

export async function getIdentityStatus(authUserId: string): Promise<IdentityVerificationSummary> {
  const r = await walletFetch<{ ok: true; verification: IdentityVerificationSummary }>({
    method: "GET",
    path: `${userBase(authUserId)}/identity`,
  })
  return r.verification
}

export async function startKycSession(
  authUserId: string,
  actor: WalletActor,
  idempotencyKey: string,
  callbackPath?: string
): Promise<KycSession> {
  return walletFetch<{ ok: true } & KycSession>({
    method: "POST",
    path: `${userBase(authUserId)}/identity/sessions`,
    idempotencyKey,
    body: { callbackPath, actor },
  })
}

export async function syncKycSession(
  authUserId: string,
  sessionId: string,
  idempotencyKey: string
): Promise<IdentityVerificationSummary> {
  const r = await walletFetch<{ ok: true; verification: IdentityVerificationSummary }>({
    method: "POST",
    path: `${userBase(authUserId)}/identity/sync`,
    idempotencyKey,
    body: { sessionId },
  })
  return r.verification
}

// ── Charges (user-readable spend history — course purchases live here) ──

export async function listUserCharges(authUserId: string, limit = 25): Promise<UserChargeItem[]> {
  const r = await walletFetch<{ ok: true; charges: UserChargeItem[] }>({
    method: "GET",
    path: `${userBase(authUserId)}/charges`,
    query: { limit, role: "spender" },
  })
  return r.charges
}
