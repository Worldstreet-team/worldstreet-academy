"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyNotifications, type NotificationFeed } from "@/lib/actions/notifications"
import { queryKeys } from "./keys"

export const NOTIFICATION_FEED_LIMIT = 40

/** The bell's feed. The sidebar's Inbox badge reads it too, so the two counts never disagree. */
export function useNotificationFeed() {
  return useQuery<NotificationFeed>({
    queryKey: queryKeys.notifications,
    queryFn: () => getMyNotifications(NOTIFICATION_FEED_LIMIT),
    staleTime: 30_000,
    refetchInterval: 120_000, // slow polling fallback; Ably invalidates live
  })
}
