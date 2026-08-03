"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu"
import { Bell } from "lucide-react"
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/actions/notifications"
import { queryKeys } from "@/lib/hooks/queries/keys"
import type { SSEEventPayload } from "@/lib/call-events"
import { AwardIcon, BellIcon, BookOpenIcon, CircleAlertIcon, CircleDollarSignIcon, DoorOpenIcon, UsersIcon } from "lucide-react"

export const typeIcons = {
  application: AwardIcon,
  course: BookOpenIcon,
  payment: CircleDollarSignIcon,
  meeting: DoorOpenIcon,
  social: UsersIcon,
  system: CircleAlertIcon,
} as const

export const typeColors = {
  application: "text-ws-warning",
  course: "text-primary",
  payment: "text-ws-success",
  meeting: "text-ws-forex",
  social: "text-ws-forex",
  system: "text-muted-foreground",
} as const

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/* ── Shared notification list ────────────────────────────── */
function NotificationList({
  notifications,
  isLoading,
  onMarkAllRead,
  onItemClick,
  onViewAll,
}: {
  notifications: NotificationItem[]
  isLoading: boolean
  onMarkAllRead: () => void
  onItemClick: (n: NotificationItem) => void
  onViewAll: () => void
}) {
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col">
      {/* Header actions */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-[11px] text-primary hover:underline px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      <Separator />

      {/* Items */}
      {isLoading ? (
        <div className="py-8 space-y-3 px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="h-5 w-5 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-2/3 rounded bg-muted" />
                <div className="h-2 w-full rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ws-raised">
            <Bell className="h-5 w-5 text-ws-muted" />
          </div>
          <p className="text-sm font-medium">No notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            You&apos;re all caught up!
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[360px]">
          <div className="py-1">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] ?? CircleAlertIcon
              const colorClasses = typeColors[notification.type] ?? "text-muted-foreground"

              const content = (
                <div
                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer ${
                    !notification.read ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <div className={`shrink-0 ${colorClasses}`}>
                    <Icon  size={18} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold leading-tight truncate">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                </div>
              )

              return notification.href ? (
                <Link
                  key={notification.id}
                  href={notification.href}
                  className="block"
                  onClick={() => onItemClick(notification)}
                >
                  {content}
                </Link>
              ) : (
                <div key={notification.id} onClick={() => onItemClick(notification)}>
                  {content}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {/* Footer — full inbox */}
      <Separator />
      <Link
        href="/dashboard/notifications"
        onClick={onViewAll}
        className="flex h-10 items-center justify-center text-xs font-medium text-primary transition-colors hover:bg-muted/50"
      >
        View all notifications
      </Link>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────── */
export function NotificationBell() {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => getMyNotifications(),
    staleTime: 30_000,
    refetchInterval: 120_000, // slow polling fallback; Ably invalidates live
  })

  const notifications = React.useMemo(() => data?.notifications ?? [], [data])
  const unreadCount = data?.unreadCount ?? 0

  // Live updates: CallProvider re-dispatches every Ably event as a window
  // CustomEvent("sse:event") — new notifications invalidate the query.
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  })

  const handleItemClick = React.useCallback(
    (n: NotificationItem) => {
      setOpen(false)
      if (!n.read) {
        markNotificationRead(n.id).then(() =>
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
        )
      }
    },
    [queryClient]
  )

  const triggerButton = (
    <button
      type="button"
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"
      aria-label="Notifications"
    >
      <BellIcon  size={18} />
      {unreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  )

  /* ── Mobile: Sheet from bottom ── */
  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{triggerButton}</div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="rounded-t-lg p-0 max-h-[85svh]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
            </div>
            <SheetHeader className="px-4 pb-2 pt-1">
              <SheetTitle className="text-base flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {unreadCount}
                  </Badge>
                )}
              </SheetTitle>
            </SheetHeader>
            <NotificationList
              notifications={notifications}
              isLoading={isLoading}
              onMarkAllRead={() => markAllMutation.mutate()}
              onItemClick={handleItemClick}
              onViewAll={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </>
    )
  }

  /* ── Desktop: DropdownMenu as popover ── */
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="focus:outline-none" render={triggerButton} />
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>
        <NotificationList
          notifications={notifications}
          isLoading={isLoading}
          onMarkAllRead={() => markAllMutation.mutate()}
          onItemClick={handleItemClick}
          onViewAll={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
