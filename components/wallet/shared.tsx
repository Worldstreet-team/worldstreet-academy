"use client"

import * as React from "react"
import type { WalletTxStatus } from "@/lib/actions/wallet"
import { CheckIcon, CopyIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"
import { cn } from "@/lib/utils"

/** Minor units → formatted money. USD cents → "$12.34", NGN kobo → "₦1,500.00" */
export function fmtMoney(minor: number, currency: "USD" | "NGN"): string {
  const sign = minor < 0 ? "-" : ""
  const abs = Math.abs(minor) / 100
  const symbol = currency === "USD" ? "$" : "₦"
  return `${sign}${symbol}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * design-system/02 ₦ glyph rule: the Latin subsets of Poppins and Public Sans
 * carry no ₦, so a naira figure slots Noto Sans between the brand face and
 * system-ui — only the missing glyph falls through. Spread onto any element
 * that renders an NGN amount (`style={NAIRA_FONT.sans}`).
 */
export const NAIRA_FONT = {
  sans: { fontFamily: 'var(--font-sans), "Noto Sans", system-ui, sans-serif' },
  display: { fontFamily: 'var(--font-display), "Noto Sans", system-ui, sans-serif' },
} as const satisfies Record<string, React.CSSProperties>

/* Status chips: a 14%/10% token wash with full-strength text (design-system/01).
   Failed reads as debit, in review as warning; pending stays neutral — it is
   waiting, not wrong. */
const TX_BADGE: Record<WalletTxStatus, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-credit-chip text-credit" },
  pending: { label: "Pending", className: "bg-accent text-muted-foreground" },
  failed: { label: "Failed", className: "bg-debit-chip text-debit" },
  review: { label: "In review", className: "bg-warning-chip text-warning" },
}

export function TxStatusBadge({ status }: { status: WalletTxStatus }) {
  const cfg = TX_BADGE[status] ?? TX_BADGE.pending
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.03em]",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  )
}

/* ── Hide balances ──────────────────────────────────────────────────────────
   The wallet page's eye toggle. Same storage key as the top bar's balance chip
   so the preference is one choice, not two. Storage can be missing or throw
   (private mode, blocked site data): every access is guarded and the page
   falls back to showing figures. The server snapshot is always "shown", so
   hydration never mismatches; the stored choice applies on the client. */

const BALANCE_HIDDEN_KEY = "ws:balance-hidden"
let balanceHidden = false
let balanceHiddenLoaded = false
const balanceHiddenListeners = new Set<() => void>()

function loadBalanceHidden() {
  if (balanceHiddenLoaded) return
  balanceHiddenLoaded = true
  try {
    balanceHidden = window.localStorage.getItem(BALANCE_HIDDEN_KEY) === "1"
  } catch {
    // Storage unavailable — keep figures visible.
  }
}

function subscribeBalanceHidden(listener: () => void) {
  loadBalanceHidden()
  balanceHiddenListeners.add(listener)
  return () => {
    balanceHiddenListeners.delete(listener)
  }
}

function getBalanceHidden() {
  loadBalanceHidden()
  return balanceHidden
}

function setBalanceHidden(next: boolean) {
  balanceHidden = next
  try {
    window.localStorage.setItem(BALANCE_HIDDEN_KEY, next ? "1" : "0")
  } catch {
    // Non-fatal: the choice just won't persist.
  }
  balanceHiddenListeners.forEach((listener) => listener())
}

export function useBalanceHidden(): readonly [hidden: boolean, toggle: () => void] {
  const hidden = React.useSyncExternalStore(subscribeBalanceHidden, getBalanceHidden, () => false)
  const toggle = React.useCallback(() => setBalanceHidden(!getBalanceHidden()), [])
  return [hidden, toggle] as const
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      aria-label={`Copy ${label ?? "value"}`}
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <RenderIcon icon={copied ? CheckIcon : CopyIcon}  size={13} />
    </button>
  )
}
