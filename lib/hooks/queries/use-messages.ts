"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getConversations,
  getMessages,
  getTotalUnreadCount,
  type ConversationWithDetails,
  type MessageWithDetails,
} from "@/lib/actions/messages"
import { queryKeys } from "./keys"

export function useConversations() {
  return useQuery<ConversationWithDetails[]>({
    queryKey: queryKeys.conversations,
    queryFn: async () => {
      const r = await getConversations()
      return r.success && r.conversations ? r.conversations : []
    },
    staleTime: 30 * 1000,
    refetchInterval: 6 * 1000,
  })
}

export function useMessages(conversationId: string | null) {
  return useQuery<MessageWithDetails[]>({
    queryKey: queryKeys.messages(conversationId ?? ""),
    queryFn: async () => {
      if (!conversationId) return []
      const r = await getMessages(conversationId)
      return r.success && r.messages ? r.messages : []
    },
    enabled: !!conversationId,
    staleTime: 0, // always re-fetch when conversation changes
  })
}

export function useUnreadCount() {
  return useQuery<number>({
    queryKey: queryKeys.unreadCount,
    queryFn: async () => {
      const r = await getTotalUnreadCount()
      return r.success && typeof r.count === "number" ? r.count : 0
    },
    staleTime: 30 * 1000,
    refetchInterval: 6 * 1000,
  })
}

/** Invalidate conversations + unread count (e.g. after sending/receiving a message) */
export function useInvalidateMessages() {
  const qc = useQueryClient()
  return (conversationId?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.conversations })
    qc.invalidateQueries({ queryKey: queryKeys.unreadCount })
    if (conversationId) {
      qc.invalidateQueries({ queryKey: queryKeys.messages(conversationId) })
    }
  }
}
