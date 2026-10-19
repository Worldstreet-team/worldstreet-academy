"use client"

import * as React from "react"
import { Countdown } from "@/components/shared/countdown"

/**
 * Live countdown to a cohort start, passed in by the caller (the next cohort
from getCohortCalendar().next, lib/cohort-calendar.ts). Unlike
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
  startsAt,
  variant = "compact",
  prefix = null,
  endedLabel = null,
  className,
  blockClassName,
}: {
  /** ISO instant the countdown runs to. */
  startsAt: string
  variant?: "blocks" | "compact"
  /** compact only: text printed before the time, e.g. "Offer ends in ". */
  prefix?: string | null
  endedLabel?: string | null
  className?: string
  /** blocks only: classes for each tile, so a banner can restyle them. */
  blockClassName?: string
}) {
  return (
    <Countdown
      target={startsAt}
      variant={variant}
      prefix={prefix}
      endedLabel={endedLabel}
      className={className}
      blockClassName={blockClassName}
      label="Time until the live cohort begins"
    />
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
export function WhileCohortUpcoming({ startsAt, children }: { startsAt: string; children: React.ReactNode }) {
  const [ended, setEnded] = React.useState(false)

  React.useEffect(() => {
    setEnded(false)
    const left = new Date(startsAt).getTime() - Date.now()
    if (left <= 0) {
      setEnded(true)
      return
    }
    if (left > MAX_TIMEOUT_MS) return
    const t = setTimeout(() => setEnded(true), left)
    return () => clearTimeout(t)
  }, [startsAt])

  return ended ? null : children
}
