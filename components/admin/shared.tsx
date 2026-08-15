"use client"

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

/**
 * Explicit tone map — gold stays reserved for CTAs and the ADMIN role badge;
 * everything else reads as success / neutral / danger at a glance.
 */
type BadgeTone = "success" | "neutral" | "danger" | "admin" | "subtle"

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-ws-success/15 text-ws-success",
  neutral: "bg-ws-chip text-ws-muted",
  danger: "bg-ws-danger/15 text-ws-danger",
  admin: "bg-ws-brand/15 text-ws-gold",
  subtle: "bg-ws-chip text-ws-subtle",
}

const STATUS_TONES: Record<string, BadgeTone> = {
  // orders
  enrolled: "success",
  paid: "success",
  pending: "neutral",
  payment_requested: "neutral",
  failed: "danger",
  cancelled: "neutral",
  refunded: "danger", // terminal — money left the platform
  // earnings
  cleared: "success",
  reversed: "danger",
  // applications
  submitted: "neutral",
  under_review: "neutral",
  interview_scheduled: "neutral",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
  // courses / exams
  draft: "neutral",
  published: "success",
  suspended: "danger",
  closed: "subtle",
  archived: "neutral",
  coming_soon: "admin", // gold — scheduled, watchable
  live: "success",
  completed: "success",
  passed: "success",
  banned: "danger",
  // enrollments
  pre_enrolled: "admin",
  active: "success",
  expired: "neutral",
  // roles
  USER: "subtle",
  INSTRUCTOR: "neutral",
  ADMIN: "admin",
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "neutral"
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${TONE_CLASSES[tone]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
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
        className="text-xs px-3 py-1.5 rounded-sm border border-ws-hairline text-ws-muted hover:bg-ws-raised hover:text-ws-primary disabled:opacity-40 disabled:pointer-events-none transition-colors"
      >
        Previous
      </button>
      <span className="text-xs text-ws-muted">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className="text-xs px-3 py-1.5 rounded-sm border border-ws-hairline text-ws-muted hover:bg-ws-raised hover:text-ws-primary disabled:opacity-40 disabled:pointer-events-none transition-colors"
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
              ? "bg-ws-brand text-ws-brand-on border-transparent font-medium"
              : "border-ws-hairline text-ws-muted hover:bg-ws-raised hover:text-ws-primary"
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
