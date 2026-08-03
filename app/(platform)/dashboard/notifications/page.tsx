"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/actions/notifications"
import {
  typeIcons,
  typeColors,
  timeAgo,
} from "@/components/shared/notification-bell"
import { queryKeys } from "@/lib/hooks/queries/keys"
import type { SSEEventPayload } from "@/lib/call-events"
import { cn } from "@/lib/utils"
import { BellIcon, CircleAlertIcon } from "lucide-react"

/**
 * Inbox query key extends the bell's `["notifications"]` prefix, so the bell's
 * invalidations (mark read, Ably `notification:new`) refresh this page too.
 */
const inboxKey = [...queryKeys.notifications, "inbox"] as const
const INBOX_LIMIT = 100

type Filter = "all" | "unread"

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: NotificationItem
  onOpen: (n: NotificationItem) => void
}) {
  const Icon = typeIcons[notification.type] ?? CircleAlertIcon
  const colorClass = typeColors[notification.type] ?? "text-muted-foreground"

  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
        <Icon  size={18} className={colorClass} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ws-primary">
            {notification.title}
          </span>
          {!notification.read && (
            <span
              aria-label="Unread"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-ws-gold"
            />
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-ws-muted">
          {notification.body}
        </span>
      </span>
      <span className="shrink-0 self-start pt-0.5 text-xs tabular-nums text-ws-subtle">
        {timeAgo(notification.createdAt)}
      </span>
    </>
  )

  const rowClass = cn(
    "flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/60",
    !notification.read && "bg-ws-surface"
  )

  return notification.href ? (
    <Link
      href={notification.href}
      className={rowClass}
      onClick={() => onOpen(notification)}
    >
      {content}
    </Link>
  ) : (
    <button type="button" className={rowClass} onClick={() => onOpen(notification)}>
      {content}
    </button>
  )
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = React.useState<Filter>("all")

  const { data, isLoading } = useQuery({
    queryKey: inboxKey,
    queryFn: () => getMyNotifications(INBOX_LIMIT),
    staleTime: 30_000,
  })

  const notifications = React.useMemo(() => data?.notifications ?? [], [data])
  const unreadCount = data?.unreadCount ?? 0
  const visible =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications

  // Live updates — same window event the bell listens to (re-dispatched Ably).
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SSEEventPayload>).detail
      if (detail?.type === "notification:new") {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      }
    }
    window.addEventListener("sse:event", handler)
    return () => window.removeEventListener("sse:event", handler)
  }, [queryClient])

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () =>
      // Prefix invalidation refreshes both the bell and this inbox.
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  })

  const handleOpen = React.useCallback(
    (n: NotificationItem) => {
      if (!n.read) {
        markNotificationRead(n.id).then(() =>
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
        )
      }
    },
    [queryClient]
  )

  const filterChips: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: unreadCount > 0 ? `Unread (${unreadCount})` : "Unread" },
  ]

  return (
    <>
      <Topbar title="Notifications" />
      <div className="flex-1 px-6 pb-24 pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-3xl space-y-8">
          <PageHeader
            title="Notifications"
            subline="Course updates, payments, meetings and account activity."
            action={
              <Button
                variant="ghost"
                size="sm"
                disabled={unreadCount === 0 || markAllMutation.isPending}
                onClick={() => markAllMutation.mutate()}
              >
                {markAllMutation.isPending ? "Marking…" : "Mark all as read"}
              </Button>
            }
          />

          {/* Filter chips */}
          <div className="flex items-center gap-2">
            {filterChips.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={cn(
                  "h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-[var(--ws-motion-fast)]",
                  filter === value
                    ? "bg-ws-chip text-ws-primary"
                    : "text-ws-muted hover:bg-ws-raised/60 hover:text-ws-primary"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="divide-y divide-ws-hairline overflow-hidden rounded-lg border border-ws-hairline">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex min-h-14 animate-pulse items-center gap-3 px-5 py-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-ws-raised" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-ws-raised" />
                    <div className="h-2.5 w-2/3 rounded bg-ws-raised" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-lg border border-ws-hairline bg-ws-surface">
              <EmptyState
                icon={BellIcon}
                title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
                description={
                  filter === "unread"
                    ? "You're all caught up — everything here has been read."
                    : "Activity about your courses, payments and meetings will land here."
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-ws-hairline overflow-hidden rounded-lg border border-ws-hairline">
              {visible.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
