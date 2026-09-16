"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ViewIcon, ViewOffIcon, Wallet01Icon } from "@hugeicons/core-free-icons"
import { getMyWalletBalance } from "@/lib/actions/wallet"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { useBalanceHidden } from "@/components/wallet/shared"

/**
 * The Worldstreet Wallet's USD balance in the top bar.
 *
 * The figure comes from the central wallet (`getMyWalletBalance`), not from
 * `user.walletBalance` — a legacy Mongo field the wallet service never writes;
 * the Academy holds no balance (lib/wallet.ts). Nothing renders while the read
 * is in flight or when the wallet is disabled: a pill reading $0.00 would claim
 * a balance nobody knows, and the wallet page explains the disabled state.
 *
 * The read is `quick` (a ~3s wallet timeout), never retried and not refetched
 * on focus: Next runs client-invoked server actions one at a time, so a slow
 * wallet must not queue every page's own actions behind a glanceable figure.
 * A timeout fails closed like any other error — the pill just stays away.
 *
 * Ink, not gold — a balance is data, and gold is never a data colour
 * (design-system 01). The eye toggle stays because this bar is in every
 * screenshot and screen-share; it shares `useBalanceHidden` with the wallet
 * page, so hiding in either place hides both. The masked state keeps the
 * character count so the pill doesn't reflow when it flips.
 */
export function BalanceChip() {
  const { data } = useQuery({
    queryKey: queryKeys.walletBalance,
    queryFn: () => getMyWalletBalance({ quick: true }),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const [hidden, toggle] = useBalanceHidden()

  if (!data?.enabled) return null

  // The wallet service speaks integer US cents.
  const formatted = (data.usdAvailableMinor / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
  // Same glyph count as the real figure, so the pill width holds steady.
  const masked = `$${"•".repeat(Math.max(formatted.length - 1, 4))}`

  return (
    <div data-tour="wallet-chip" className="hidden h-10 shrink-0 items-center rounded-full bg-surface-sunken pr-1 ring-1 ring-border/70 transition-colors duration-[var(--ws-motion-fast)] focus-within:ring-2 focus-within:ring-primary/40 hover:bg-accent lg:inline-flex">
      <Link
        href="/dashboard/wallet"
        aria-label={`Wallet balance ${hidden ? "hidden" : formatted}. Open wallet.`}
        className="flex h-full items-center gap-2 rounded-full pl-3.5 pr-1.5 outline-none"
      >
        <HugeiconsIcon icon={Wallet01Icon} aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        {/* No pre-mount visibility guard needed: the figure only exists after a
            client fetch, by which point the store has its stored value. */}
        <span className="text-[13px] font-semibold leading-none tabular-nums text-foreground">
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
