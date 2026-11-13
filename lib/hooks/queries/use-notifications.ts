"use client"

import { useQuery } from "@tanstack/react-query"
import { getMyNotifications, type NotificationFeed } from "@/lib/actions/notifications"
import { queryKeys } from "./keys"
import { afterPageHydration } from "./after-hydration"

export const NOTIFICATION_FEED_LIMIT = 40

/** The bell's feed. The sidebar's Inbox badge reads it too, so the two counts never disagree. */
export function useNotificationFeed() {
  return useQuery<NotificationFeed>({
    queryKey: queryKeys.notifications,
    // 2026-11-12: waits for the page to hydrate — the rail's Inbox badge shares this
    // with every page's bell (after-hydration.ts, React #418). Was:
    // queryFn: () => getMyNotifications(NOTIFICATION_FEED_LIMIT),
    queryFn: async () => {
      await afterPageHydration()
      return getMyNotifications(NOTIFICATION_FEED_LIMIT)
    },
    staleTime: 30_000,
    refetchInterval: 120_000, // slow polling fallback; Ably invalidates live
  })
}
