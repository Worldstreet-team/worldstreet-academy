"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useUnreadCount as useUnreadCountQuery, queryKeys } from "@/lib/hooks/queries"
import { useMessageEvents } from "@/lib/hooks/use-call-events"
import { useUser } from "@/components/providers/user-provider"

export function useUnreadCount() {
  const user = useUser()
  const qc = useQueryClient()
  const { data: count = 0 } = useUnreadCountQuery()

  // Instant refresh when real-time message events arrive
  const handleMessageEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.unreadCount })
    qc.invalidateQueries({ queryKey: queryKeys.conversations })
  }, [qc])

  useMessageEvents(user.id, handleMessageEvent)

  return count
}
