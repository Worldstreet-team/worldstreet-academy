"use client"

import { Badge } from "@/components/ui/badge"

/** Integer minor units (cents) → "$12.34" */
export function money(minor: number, currency = "USD"): string {
  const sign = minor < 0 ? "-" : ""
  const abs = Math.abs(minor)
  const symbol = currency === "USD" ? "$" : `${currency} `
  return `${sign}${symbol}${(abs / 100).toFixed(2)}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  // orders
  enrolled: "default",
  paid: "secondary",
  pending: "outline",
  payment_requested: "outline",
  failed: "destructive",
  cancelled: "outline",
  refunded: "destructive",
  // earnings
  cleared: "default",
  reversed: "destructive",
  // applications
  submitted: "secondary",
  under_review: "default",
  interview_scheduled: "default",
  approved: "default",
  rejected: "destructive",
  withdrawn: "outline",
  // courses
  draft: "outline",
  published: "default",
  archived: "secondary",
  // roles
  USER: "outline",
  INSTRUCTOR: "secondary",
  ADMIN: "default",
}

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANTS[status] ?? "outline"
  return (
    <Badge variant={variant} className="text-[10px] capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  )
}

/** Simple prev/next pagination footer. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-between pt-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
      >
        Previous
      </button>
      <span className="text-xs text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className="text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
      >
        Next
      </button>
    </div>
  )
}

/** Filter chip row (status filters etc.) */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            value === opt.value
              ? "bg-foreground text-background border-foreground"
              : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          {opt.label}
          {typeof opt.count === "number" && (
            <span className="ml-1 opacity-60">{opt.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
