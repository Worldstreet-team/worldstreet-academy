"use client"

import { useState, useEffect, useCallback } from "react"
import { getTotalUnreadCount } from "@/lib/actions/messages"
import { useMessageEvents } from "@/lib/hooks/use-call-events"
import { useUser } from "@/components/providers/user-provider"

export function useUnreadCount(interval = 30000) {
  const [count, setCount] = useState(0)
  const user = useUser()

  const refresh = useCallback(async () => {
    const result = await getTotalUnreadCount()
    if (result.success && typeof result.count === "number") {
      setCount(result.count)
    }
  }, [])

  // Refresh on mount + slower polling as fallback
  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, interval)
    return () => clearInterval(timer)
  }, [refresh, interval])

  // Instant refresh when real-time message events arrive
  const handleMessageEvent = useCallback(() => {
    refresh()
  }, [refresh])

  useMessageEvents(user.id, handleMessageEvent)

  return count
}
