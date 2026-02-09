"use client"

import { useState, useEffect, useCallback } from "react"
import { getTotalUnreadCount } from "@/lib/actions/messages"

export function useUnreadCount(interval = 10000) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    const result = await getTotalUnreadCount()
    if (result.success && typeof result.count === "number") {
      setCount(result.count)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, interval)
    return () => clearInterval(timer)
  }, [refresh, interval])

  return count
}
