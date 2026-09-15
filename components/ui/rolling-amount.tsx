"use client"

/**
 * RollingAmount — the balance odometer, ported from the hub
 * (dashboard-revamp/components/ui/rolling-amount.tsx), itself a port of the
 * mobile app's `features/wallet/rolling-amount.tsx`.
 *
 * When the value changes (live refresh, view switch) each character rolls to
 * its replacement vertically, and ADJACENT DIGITS ROLL IN OPPOSITE
 * DIRECTIONS, so the number reads as a bank of counters spinning against each
 * other rather than one block sliding. Each slot carves out its own staggered
 * window, so the cascade sweeps left to right.
 *
 * Travel is in `em`, so this works at any font-size — including the hero's
 * clamp() — without being told a pixel height. Keyframes (`.roll-in` /
 * `.roll-out`) live in app/globals.css.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

const ROLL_MS = 340    // one slot's roll
const STAGGER_MS = 22  // per-slot offset of the sweep

export function RollingAmount({
  value,
  className,
}: {
  /** Pre-formatted display string, e.g. "$1,234.56". */
  value: string
  className?: string
}) {
  // What we last received, what we were showing before it, and a generation
  // bumped on every change so React remounts the slots and the CSS animations
  // actually re-fire (same-name animations don't restart on their own).
  //
  // The hub swaps refs during render and bumps the generation from a layout
  // effect; this repo's lint (react-hooks/refs, set-state-in-effect) rejects
  // both. A render-phase state update is React's sanctioned way to derive
  // from a changed prop: React re-renders before committing, so the displayed
  // text is still always the incoming prop — no stale frame.
  const [roll, setRoll] = React.useState({ shown: value, outgoing: value, gen: 0 })
  if (value !== roll.shown) {
    setRoll({ shown: value, outgoing: roll.shown, gen: roll.gen + 1 })
  }

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  const chars = value.split("")
  const prevChars = roll.outgoing.split("")
  // Direction alternates per DIGIT position (not raw index), so separators
  // don't break the up/down/up rhythm the eye latches onto.
  let digitAt = 0

  return (
    <span className={cn("inline-flex items-end tabular-nums", className)} aria-label={value}>
      {chars.map((ch, i) => {
        const isDigit = ch >= "0" && ch <= "9"
        const dir = isDigit ? (digitAt++ % 2 === 0 ? -1 : 1) : -1
        const prev = prevChars[i] ?? ""
        const changed = ch !== prev && !reduced

        return (
          <span
            key={`${roll.gen}-${i}`}
            className="relative inline-block overflow-hidden"
            style={{ ["--rd" as string]: String(dir) }}
          >
            {/* invisible sizer keeps the slot exactly the width of the current char */}
            <span className="invisible" aria-hidden>{ch === " " ? " " : ch}</span>

            <span
              aria-hidden
              className={cn("absolute left-0 top-0 whitespace-pre", changed && "roll-in")}
              style={changed ? { animationDelay: `${i * STAGGER_MS}ms` } : undefined}
            >
              {ch}
            </span>

            {changed && (
              <span
                aria-hidden
                className="roll-out absolute left-0 top-0 whitespace-pre"
                style={{ animationDelay: `${i * STAGGER_MS}ms` }}
              >
                {prev}
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

export const ROLL_TIMING = { ROLL_MS, STAGGER_MS }
