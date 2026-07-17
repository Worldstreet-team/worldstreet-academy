"use server"

import { getCurrentUser } from "@/lib/auth/actions"
import { getWalletBalances, walletEnabled } from "@/lib/wallet"

export type MyWalletBalance = {
  enabled: boolean
  usdAvailableMinor: number
  usdAvailable: number
  /** Where the user funds their central balance (the Worldstreet dashboard, not the Academy). */
  fundingUrl: string
}

const FUNDING_URL =
  process.env.NEXT_PUBLIC_WALLET_FUNDING_URL || "https://dashboard.worldstreetgold.com/deposit"

/**
 * The signed-in user's central Worldstreet wallet balance (read-only proxy).
 * The Academy never stores a balance of its own — this is the wallet service's
 * number, shown at checkout so users can see whether they can afford a course.
 */
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
