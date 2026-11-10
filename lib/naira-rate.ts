import "server-only"
import { NairaRate, type INairaRate } from "@/lib/db/models"
import type { NairaQuote } from "@/lib/payment-channels"

/**
 * The naira rate checkout quotes a bank transfer at (client, 2026-11-05: "use a
 * fixed exchange rate at checkout, it can be updated automatically if
 * possible"; Owen: the Parallex account takes naira, and the rate comes from a
 * daily feed an admin can override). An admin's pinned rate wins; otherwise the
 * market rate from ExchangeRate-API's open endpoint (no key; it updates once a
 * day and asks for a credit wherever its rate shows, NAIRA_FEED_CREDIT). The
 * last reading is stored, so every instance quotes the same rate and a feed
 * outage keeps the last one for a few days. With neither, there is
 * no quote and checkout asks the learner to confirm the rate on WhatsApp, as
 * before. Callers have already run connectDB().
 */

const FEED_URL = "https://open.er-api.com/v6/latest/USD"
/** The feed updates daily; a stored reading younger than this is reused as is. */
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000
/** A market rate older than this (by the feed's own date) is too stale to quote. */
const STALE_AFTER_MS = 4 * 24 * 60 * 60 * 1000
const FEED_TIMEOUT_MS = 3500
/** After a failed fetch, this instance leaves the feed alone for a while — checkout never waits on it twice. */
const RETRY_AFTER_MS = 10 * 60 * 1000
/** A rate outside this band is a bad reading or a typo, never quoted. */
export const NAIRA_RATE_MIN = 100
export const NAIRA_RATE_MAX = 100_000
/** Replaced rates kept, and how long a proof may still be submitted at one (a learner pays, then submits). */
const RECENT_KEEP = 6
const RECENT_FOR_MS = 3 * 24 * 60 * 60 * 1000

let nextFeedAttempt = 0

type Market = NonNullable<INairaRate["market"]>

/** The `$push` that records `old` as replaced, or nothing when it isn't (none, or the same rate). */
function retire(old: { ngnPerUsd: number } | null | undefined, source: "pinned" | "market", next: number | null) {
  if (!old || old.ngnPerUsd === next) return {}
  return {
    $push: { recent: { $each: [{ ngnPerUsd: old.ngnPerUsd, source, until: new Date() }], $slice: -RECENT_KEEP } },
  }
}

/** Naira per $1 from the feed, to the kobo, or null (unreachable, odd answer, or resting after a failure). */
async function fetchMarketRate(): Promise<{ ngnPerUsd: number; asOf: Date } | null> {
  if (Date.now() < nextFeedAttempt) return null
  try {
    const res = await fetch(FEED_URL, { cache: "no-store", signal: AbortSignal.timeout(FEED_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as {
      result?: string
      base_code?: string
      time_last_update_unix?: number
      rates?: Record<string, unknown>
    }
    const rate = body.rates?.NGN
    if (body.result !== "success" || body.base_code !== "USD" || typeof rate !== "number" || !Number.isFinite(rate)) {
      throw new Error("unexpected answer from the rate feed")
    }
    if (rate < NAIRA_RATE_MIN || rate > NAIRA_RATE_MAX) throw new Error(`implausible NGN rate ${rate}`)
    const asOf = typeof body.time_last_update_unix === "number" ? new Date(body.time_last_update_unix * 1000) : new Date()
    return { ngnPerUsd: Math.round(rate * 100) / 100, asOf }
  } catch (err) {
    nextFeedAttempt = Date.now() + RETRY_AFTER_MS
    console.error("[NairaRate] market feed failed:", err)
    return null
  }
}

/** The stored market reading, refreshed from the feed when it is over 12 hours old; null when none is fit to quote. */
async function marketRate(stored: Market | null): Promise<Market | null> {
  if (stored && Date.now() - stored.fetchedAt.getTime() < REFRESH_AFTER_MS) return stored
  const fresh = await fetchMarketRate()
  if (fresh) {
    const market: Market = { ...fresh, fetchedAt: new Date() }
    await NairaRate.updateOne(
      { key: "USD_NGN" },
      { $set: { market }, ...retire(stored, "market", market.ngnPerUsd) },
      { upsert: true }
    ).catch((err) => console.error("[NairaRate] couldn't store the market rate:", err))
    return market
  }
  return stored && Date.now() - stored.asOf.getTime() < STALE_AFTER_MS ? stored : null
}

/** The rate checkout quotes right now: the pinned one, else the market's, else null. Never throws. */
export async function getNairaQuote(): Promise<NairaQuote | null> {
  try {
    const row = await NairaRate.findOne({ key: "USD_NGN" }).lean()
    if (row?.pinned) return { ngnPerUsd: row.pinned.ngnPerUsd, source: "pinned", asOf: row.pinned.at.toISOString() }
    const market = await marketRate(row?.market ?? null)
    return market ? { ngnPerUsd: market.ngnPerUsd, source: "market", asOf: market.asOf.toISOString() } : null
  } catch (err) {
    console.error("[NairaRate] couldn't read the rate:", err)
    return null
  }
}

export type NairaRateAdminView = {
  /** What checkout quotes now. */
  quote: NairaQuote | null
  market: { ngnPerUsd: number; asOf: string } | null
  pinned: { ngnPerUsd: number; byName: string; at: string } | null
}

/** Both rates for the admin card — the market one is refreshed even while a pin is set. */
export async function getNairaRateAdminView(): Promise<NairaRateAdminView> {
  const row = await NairaRate.findOne({ key: "USD_NGN" }).lean()
  const market = await marketRate(row?.market ?? null)
  const pinned = row?.pinned ?? null
  return {
    quote: pinned
      ? { ngnPerUsd: pinned.ngnPerUsd, source: "pinned", asOf: pinned.at.toISOString() }
      : market
        ? { ngnPerUsd: market.ngnPerUsd, source: "market", asOf: market.asOf.toISOString() }
        : null,
    market: market ? { ngnPerUsd: market.ngnPerUsd, asOf: market.asOf.toISOString() } : null,
    pinned: pinned ? { ngnPerUsd: pinned.ngnPerUsd, byName: pinned.byName, at: pinned.at.toISOString() } : null,
  }
}

/** Pin `ngnPerUsd` (an admin's rate, checked by the caller), or clear the pin with null. */
export async function setPinnedNairaRate(
  ngnPerUsd: number | null,
  admin: { id: string; name: string }
): Promise<void> {
  const before = await NairaRate.findOne({ key: "USD_NGN" }).select("pinned").lean()
  await NairaRate.updateOne(
    { key: "USD_NGN" },
    {
      $set: {
        pinned:
          ngnPerUsd === null ? null : { ngnPerUsd, by: admin.id, byName: admin.name, at: new Date() },
      },
      ...retire(before?.pinned, "pinned", ngnPerUsd),
    },
    { upsert: true }
  )
}

/**
 * The rate a learner's bank amount was shown at, if this server quoted it
 * within the last few days: the pin, the stored market reading (quoted when
 * there is no pin, or until a pin was set), or a recently replaced rate.
 * Null otherwise — the browser's figure is never trusted on its own. Callers
 * have already run connectDB(). Never throws.
 */
export async function recentlyQuotedRate(
  ngnPerUsd: number
): Promise<{ ngnPerUsd: number; source: "pinned" | "market" } | null> {
  try {
    const row = await NairaRate.findOne({ key: "USD_NGN" }).lean()
    if (!row) return null
    if (row.pinned?.ngnPerUsd === ngnPerUsd) return { ngnPerUsd, source: "pinned" }
    if (row.market?.ngnPerUsd === ngnPerUsd && Date.now() - row.market.asOf.getTime() < STALE_AFTER_MS) {
      return { ngnPerUsd, source: "market" }
    }
    const since = Date.now() - RECENT_FOR_MS
    const hit = (row.recent ?? []).find((r) => r.ngnPerUsd === ngnPerUsd && r.until.getTime() > since)
    return hit ? { ngnPerUsd, source: hit.source } : null
  } catch (err) {
    console.error("[NairaRate] couldn't check the quoted rate:", err)
    return null
  }
}
