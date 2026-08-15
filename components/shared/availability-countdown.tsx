"use client"

import * as React from "react"

/**
 * Live countdown to a course's availability instant.
 *
 * Owns the flip: when the clock crosses availableAt it calls router.refresh()
 * once, so the server re-derives "live" and every CTA on the page swaps
 * without a manual reload — the closest a page gets to the status "changing
 * automatically" without a cron.
 */
import { useRouter } from "next/navigation"

type Parts = { days: number; hours: number; minutes: number; seconds: number }

function partsUntil(target: number, now: number): Parts | null {
  const diff = target - now
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  }
}

const pad = (n: number) => String(n).padStart(2, "0")

export function AvailabilityCountdown({
  availableAt,
  variant = "full",
  className,
}: {
  availableAt: string
  /** full = labelled blocks (details page) · compact = "5d 03h 42m" chip text */
  variant?: "full" | "compact"
  className?: string
}) {
  const router = useRouter()
  const target = React.useMemo(() => new Date(availableAt).getTime(), [availableAt])
  // null until mounted: server + first client render agree, so no hydration drift.
  const [parts, setParts] = React.useState<Parts | null | "pending">("pending")
  const refreshed = React.useRef(false)

  React.useEffect(() => {
    const tick = () => {
      const next = partsUntil(target, Date.now())
      setParts(next)
      if (next === null && !refreshed.current) {
        refreshed.current = true
        router.refresh()
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [target, router])

  if (parts === "pending") {
    return <span className={className} aria-hidden="true" />
  }

  if (parts === null) {
    // Crossed the line: the refresh is in flight; say so rather than 00:00:00.
    return <span className={className}>Live now</span>
  }

  if (variant === "compact") {
    return (
      <span className={className}>
        {parts.days > 0 ? `${parts.days}d ` : ""}
        {pad(parts.hours)}h {pad(parts.minutes)}m
        {parts.days === 0 ? ` ${pad(parts.seconds)}s` : ""}
      </span>
    )
  }

  const blocks: Array<[number, string]> = [
    [parts.days, "Days"],
    [parts.hours, "Hours"],
    [parts.minutes, "Minutes"],
    [parts.seconds, "Seconds"],
  ]

  return (
    <div className={className} role="timer" aria-label="Time until this course goes live">
      <div className="flex items-center gap-2">
        {blocks.map(([value, label]) => (
          <div
            key={label}
            className="flex min-w-14 flex-col items-center rounded-md bg-ws-chip px-2 py-1.5"
          >
            <span className="text-lg font-bold tabular-nums leading-tight">{pad(value)}</span>
            <span className="text-[9px] uppercase tracking-wide text-ws-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
