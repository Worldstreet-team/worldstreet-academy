"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ViewIcon, ViewOffIcon, Wallet01Icon } from "@hugeicons/core-free-icons"
import { getMyWalletBalance } from "@/lib/actions/wallet"
import { queryKeys } from "@/lib/hooks/queries/keys"

const STORAGE_KEY = "ws:balance-hidden"

/**
 * The Worldstreet Wallet's USD balance in the top bar.
 *
 * The figure comes from the central wallet (`getMyWalletBalance`), not from
 * `user.walletBalance` — a legacy Mongo field the wallet service never writes;
 * the Academy holds no balance (lib/wallet.ts). Nothing renders while the read
 * is in flight or when the wallet is disabled: a pill reading $0.00 would claim
 * a balance nobody knows, and the wallet page explains the disabled state.
 *
 * Ink, not gold — a balance is data, and gold is never a data colour
 * (design-system 01). The eye toggle stays because this bar is in every
 * screenshot and screen-share; the masked state keeps the character count so
 * the pill doesn't reflow when it flips.
 */
export function BalanceChip() {
  const { data } = useQuery({
    queryKey: queryKeys.walletBalance,
    queryFn: () => getMyWalletBalance(),
    staleTime: 60_000,
  })

  // Default to visible and correct after mount — reading localStorage during
  // render would desync the server-rendered markup.
  const [hidden, setHidden] = React.useState(false)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      // Private mode / storage disabled — stay visible.
    }
    setReady(true)
  }, [])

  const toggle = React.useCallback(() => {
    setHidden((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch {
        // Non-fatal: the preference just won't persist.
      }
      return next
    })
  }, [])

  if (!data?.enabled) return null

  // The wallet service speaks integer US cents.
  const formatted = (data.usdAvailableMinor / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
  // Same glyph count as the real figure, so the pill width holds steady.
  const masked = `$${"•".repeat(Math.max(formatted.length - 1, 4))}`

  return (
    <div className="hidden h-10 shrink-0 items-center rounded-full bg-surface-sunken pr-1 ring-1 ring-border/70 transition-colors duration-[var(--ws-motion-fast)] focus-within:ring-2 focus-within:ring-primary/40 hover:bg-accent lg:inline-flex">
      <Link
        href="/dashboard/wallet"
        aria-label={`Wallet balance ${hidden ? "hidden" : formatted}. Open wallet.`}
        className="flex h-full items-center gap-2 rounded-full pl-3.5 pr-1.5 outline-none"
      >
        <HugeiconsIcon icon={Wallet01Icon} aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span
          className="text-[13px] font-semibold leading-none tabular-nums text-foreground"
          // Avoid a flash of the real figure before the stored preference loads.
          style={{ visibility: ready ? "visible" : "hidden" }}
        >
          {hidden ? masked : formatted}
        </span>
      </Link>

      <button
        type="button"
        onClick={toggle}
        aria-label={hidden ? "Show balance" : "Hide balance"}
        aria-pressed={hidden}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <HugeiconsIcon icon={hidden ? ViewOffIcon : ViewIcon} className="size-3.5" />
      </button>
    </div>
  )
}
