"use client"

import * as React from "react"
import Link from "next/link"
import { Eye, EyeOff, Wallet } from "lucide-react"

const STORAGE_KEY = "ws:balance-hidden"

/**
 * Wallet balance in the top bar.
 *
 * Design system: `bg/chip` pill, amount gold SemiBold 13, tabular numerals
 * (05-screens Academy TopNav), a `wallet` glyph because that's what the
 * glyph-to-icon table assigns to a balance chip, and an `eye` visibility
 * toggle — the pattern the system pairs with every balance.
 *
 * The toggle isn't decoration: this balance sits in a persistent bar, so it's
 * in every screenshot, screen-share and over-the-shoulder glance the user ever
 * takes. The masked state keeps the same character count so the bar doesn't
 * reflow when it flips.
 */
export function BalanceChip({ balance }: { balance: number }) {
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

  const formatted = balance.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  // Same glyph count as the real figure, so the pill width holds steady.
  const masked = "•".repeat(Math.max(formatted.length, 4))

  return (
    <div className="hidden items-center gap-1 rounded-full bg-ws-chip pr-1 transition-colors duration-[var(--ws-motion-fast)] focus-within:ring-2 focus-within:ring-ws-brand focus-within:ring-offset-2 focus-within:ring-offset-ws-surface hover:bg-ws-raised sm:inline-flex">
      <Link
        href="/dashboard/wallet"
        aria-label={`Wallet balance ${hidden ? "hidden" : `$${formatted}`}. Open wallet.`}
        className="flex h-8 items-center gap-2 rounded-full pl-3 pr-1 outline-none"
      >
        <Wallet size={14} strokeWidth={2} className="shrink-0 text-ws-gold" aria-hidden />
        <span
          className="text-[13px] font-semibold tabular-nums leading-none text-ws-gold"
          // Avoid a flash of the real figure before the stored preference loads.
          style={{ visibility: ready ? "visible" : "hidden" }}
        >
          {hidden ? masked : `$${formatted}`}
        </span>
      </Link>

      <button
        type="button"
        onClick={toggle}
        aria-label={hidden ? "Show balance" : "Hide balance"}
        aria-pressed={hidden}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ws-muted outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"
      >
        {hidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
      </button>
    </div>
  )
}
