"use client"

import * as React from "react"
import { partsUntil, type Parts } from "@/components/shared/availability-countdown"
import { COHORT_STARTS_AT_ISO } from "@/lib/cohort"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Live countdown to the next cohort (lib/cohort.ts). Unlike
 * AvailabilityCountdown it never refreshes the page: nothing on the server
 * flips at the cohort start, so once the instant passes it shows `endedLabel`
 * (or nothing). Renders an empty placeholder until mounted, so the server and
 * the first client render agree.
 *
 * blocks  = labelled Days/Hours/Minutes/Seconds tiles (banners)
 * compact = "12d 04h 31m 09s" inline text (chips, package cards)
 *
 * `prefix` ("Offer ends in ") belongs to the countdown, so it disappears with
 * it — a caller never strands a label in front of nothing.
 */
export function CohortCountdown({
  variant = "compact",
  prefix = null,
  endedLabel = null,
  className,
  blockClassName,
}: {
  variant?: "blocks" | "compact"
  /** compact only: text printed before the time, e.g. "Offer ends in ". */
  prefix?: string | null
  endedLabel?: string | null
  className?: string
  /** blocks only: classes for each tile, so a banner can restyle them. */
  blockClassName?: string
}) {
  const target = React.useMemo(() => new Date(COHORT_STARTS_AT_ISO).getTime(), [])
  const [parts, setParts] = React.useState<Parts | null | "pending">("pending")

  React.useEffect(() => {
    const tick = () => setParts(partsUntil(target, Date.now()))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [target])

  if (parts === "pending") return <span className={className} aria-hidden="true" />
  if (parts === null) return endedLabel ? <span className={className}>{endedLabel}</span> : null

  if (variant === "compact") {
    return (
      <span className={cn("tabular-nums", className)} role="timer" aria-label="Time until the live cohort begins">
        {prefix}
        {parts.days > 0 ? `${parts.days}d ` : ""}
        {pad(parts.hours)}h {pad(parts.minutes)}m {pad(parts.seconds)}s
      </span>
    )
  }

  const blocks: Array<[number, string]> = [
    [parts.days, "Days"],
    [parts.hours, "Hours"],
    [parts.minutes, "Mins"],
    [parts.seconds, "Secs"],
  ]

  return (
    <div className={cn("flex items-center gap-2", className)} role="timer" aria-label="Time until the live cohort begins">
      {blocks.map(([value, label]) => (
        <div
          key={label}
          className={cn("flex min-w-14 flex-col items-center rounded-[9px] bg-ws-chip px-2 py-1.5", blockClassName)}
        >
          <span className="text-lg font-bold tabular-nums leading-tight">{pad(value)}</span>
          <span className="text-[9px] uppercase tracking-wide text-ws-muted">{label}</span>
        </div>
      ))}
    </div>
  )
}

/** setTimeout's ceiling (~24.8 days); a later start is caught on the next visit. */
const MAX_TIMEOUT_MS = 2_147_483_647

/**
 * Shows its children only until the cohort begins. Server copy on a cached
 * marketing page would otherwise outlive the date ("begins Monday 19 October"
 * with its timer gone), so the browser removes it at the instant, and on any
 * load after it.
 */
export function WhileCohortUpcoming({ children }: { children: React.ReactNode }) {
  const [ended, setEnded] = React.useState(false)

  React.useEffect(() => {
    const left = new Date(COHORT_STARTS_AT_ISO).getTime() - Date.now()
    if (left <= 0) {
      setEnded(true)
      return
    }
    if (left > MAX_TIMEOUT_MS) return
    const t = setTimeout(() => setEnded(true), left)
    return () => clearTimeout(t)
  }, [])

  return ended ? null : children
}
