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
  method: "GET" | "POST"
  path: string
  body?: Record<string, unknown>
  idempotencyKey?: string
}

async function walletFetch<T>({ method, path, body, idempotencyKey }: WalletRequest): Promise<T> {
  if (!walletEnabled()) {
    throw new WalletError("WALLET_DISABLED", 503, "Wallet service is not configured")
  }

  const headers: Record<string, string> = {
    "X-Wallet-Service-Token": SERVICE_TOKEN,
    "Content-Type": "application/json",
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
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
