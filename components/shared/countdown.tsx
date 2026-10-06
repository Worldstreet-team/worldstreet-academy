"use client"

import * as React from "react"
import { partsUntil, type Parts } from "@/components/shared/availability-countdown"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * A live countdown to any instant — the next class, the cohort start, an
 * offer's end. It never refreshes the page; once `target` passes it shows
 * `endedLabel` (or nothing) and calls `onEnd` once, so a caller can swap its
 * own state (a class card flipping to "starting now"). Renders an empty
 * placeholder until mounted, so the server and the first client render agree.
 *
 * blocks  = labelled Days/Hours/Mins/Secs tiles (heroes, banners)
 * compact = "2d 04h 31m 09s" inline text (chips, stat cells)
 * short   = the single largest unit, "in 2d" / "in 4h" / "in 12m" (tab chips)
 *
 * `prefix` belongs to the countdown, so it disappears with it.
 */
export function Countdown({
  target,
  variant = "compact",
  prefix = null,
  endedLabel = null,
  onEnd,
  className,
  blockClassName,
  label = "Time remaining",
}: {
  /** ISO instant. */
  target: string
  variant?: "blocks" | "compact" | "short"
  prefix?: string | null
  endedLabel?: React.ReactNode
  onEnd?: () => void
  className?: string
  /** blocks only: classes for each tile. */
  blockClassName?: string
  /** Accessible name of the timer. */
  label?: string
}) {
  const at = React.useMemo(() => new Date(target).getTime(), [target])
  const [parts, setParts] = React.useState<Parts | null | "pending">("pending")
  const ended = React.useRef(false)
  const onEndRef = React.useRef(onEnd)
  React.useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  React.useEffect(() => {
    ended.current = false
    const tick = () => {
      const next = partsUntil(at, Date.now())
      setParts(next)
      if (next === null && !ended.current) {
        ended.current = true
        onEndRef.current?.()
      }
    }
    tick()
    // The short form only changes by the minute at most; tick it slower.
    const iv = setInterval(tick, variant === "short" ? 15_000 : 1000)
    return () => clearInterval(iv)
  }, [at, variant])

  if (parts === "pending") return <span className={className} aria-hidden="true" />
  if (parts === null) return endedLabel ? <span className={className}>{endedLabel}</span> : null

  if (variant === "short") {
    const text =
      parts.days > 0 ? `${parts.days}d` : parts.hours > 0 ? `${parts.hours}h` : `${Math.max(1, parts.minutes)}m`
    return (
      <span className={cn("tabular-nums", className)}>
        {prefix}
        {text}
      </span>
    )
  }

  if (variant === "compact") {
    return (
      <span className={cn("tabular-nums", className)} role="timer" aria-label={label}>
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
    <div className={cn("flex items-center gap-2", className)} role="timer" aria-label={label}>
      {blocks.map(([value, unit]) => (
        <div
          key={unit}
          className={cn("flex min-w-14 flex-col items-center rounded-[9px] bg-ws-chip px-2 py-1.5", blockClassName)}
        >
          <span className="text-lg font-bold tabular-nums leading-tight">{pad(value)}</span>
          <span className="text-[9px] uppercase tracking-wide text-ws-muted">{unit}</span>
        </div>
      ))}
    </div>
  )
}
