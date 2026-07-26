"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import type { WalletTxStatus } from "@/lib/actions/wallet"

/** Minor units → formatted money. USD cents → "$12.34", NGN kobo → "₦1,500.00" */
export function fmtMoney(minor: number, currency: "USD" | "NGN"): string {
  const sign = minor < 0 ? "-" : ""
  const abs = Math.abs(minor) / 100
  const symbol = currency === "USD" ? "$" : "₦"
  return `${sign}${symbol}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const TX_BADGE: Record<WalletTxStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "completed", variant: "secondary" },
  pending: { label: "pending", variant: "outline" },
  failed: { label: "failed", variant: "destructive" },
  review: { label: "in review", variant: "outline" },
}

export function TxStatusBadge({ status }: { status: WalletTxStatus }) {
  const cfg = TX_BADGE[status] ?? TX_BADGE.pending
  return (
    <Badge variant={cfg.variant} className="text-[9px]">
      {cfg.label}
    </Badge>
  )
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
      <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={13} />
    </button>
  )
}
