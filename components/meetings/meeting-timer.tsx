"use client"

import { useState, useEffect } from "react"

export function MeetingTimer({ startTime }: { startTime: Date | null }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const iv = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000)),
      1000,
    )
    return () => clearInterval(iv)
  }, [startTime])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  return (
    <span className="tabular-nums text-sm font-medium text-muted-foreground">
      {h > 0 && `${h}:`}
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  )
}
