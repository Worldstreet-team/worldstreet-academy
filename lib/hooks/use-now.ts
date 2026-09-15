"use client"

import * as React from "react"

/**
 * The current time as state, re-read on an interval. Rendering reads this
 * instead of calling Date.now() during render, which is impure: two renders in
 * the same tick could disagree. Minute resolution is what the dashboard's
 * relative labels ("Waiting for your instructor", "Opens Sep 30") need.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const MINUTE_MS = 60_000

/** Re-reads every 15s; the snapshot only changes with the minute, so subscribers re-render at most once a minute. */
function subscribeToClock(onChange: () => void): () => void {
  const id = setInterval(onChange, 15_000)
  return () => clearInterval(id)
}

function readClock(): number {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS
}

function readServerClock(): null {
  return null
}

/**
 * The browser's clock to the minute — null on the server and through
 * hydration. For text that depends on the student's own timezone (the
 * greeting, today's date): the server's clock is the container's, often UTC,
 * and React 19 never patches a mismatched text node (suppressHydrationWarning
 * only silences it). Render a same-size placeholder while this is null; a
 * client-side navigation gets the real value on its first render.
 */
export function useClientNow(): number | null {
  return React.useSyncExternalStore<number | null>(subscribeToClock, readClock, readServerClock)
}
