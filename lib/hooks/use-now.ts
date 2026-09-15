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
