"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Notification03Icon } from "@hugeicons/core-free-icons"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import { Segmented } from "@/components/ui/system"
import { NotificationRow } from "@/components/notifications/notification-row"
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationFeed,
  type NotificationItem,
} from "@/lib/actions/notifications"
import { queryKeys } from "@/lib/hooks/queries/keys"
import type { SSEEventPayload } from "@/lib/call-events"

/**
 * The top bar's notification hub. Course activity — lessons, live classes,
 * grades, exams, certificates, mentorship — is the default view; payments and
 * account housekeeping wait under "Other" so they never bury what a learner
 * opened the bell for.
 */

type BellTab = "courses" | "other"

const BELL_LIMIT = 40
const BELL_ROWS = 8

function BellPanel({
  feed,
  isLoading,
  onOpen,
  onClose,
}: {
  feed: NotificationFeed | undefined
  isLoading: boolean
  onOpen: (n: NotificationItem) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [tab, setTab] = React.useState<BellTab>("courses")

  const counts = feed?.unreadByCategory ?? { courses: 0, payments: 0, account: 0 }
  const otherUnread = counts.payments + counts.account
  const tabUnread = tab === "courses" ? counts.courses : otherUnread
  const rows = (feed?.notifications ?? [])
    .filter((n) => (tab === "courses" ? n.category === "courses" : n.category !== "courses"))
    .slice(0, BELL_ROWS)

  const markTab = useMutation({
    mutationFn: async () => {
      if (tab === "courses") await markAllNotificationsRead("courses")
      else await Promise.all([markAllNotificationsRead("payments"), markAllNotificationsRead("account")])
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  })

  return (
    <div className="flex max-h-[min(36rem,80svh)] flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="font-display text-[16px] font-semibold text-foreground">Notifications</h3>
          {(feed?.unreadCount ?? 0) > 0 && (
            <span className="rounded-full bg-primary/[0.14] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
              {feed?.unreadCount} new
            </span>
          )}
        </div>
        {tabUnread > 0 && (
          <button
            type="button"
            onClick={() => markTab.mutate()}
            disabled={markTab.isPending}
            className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Mark as read
          </button>
        )}
      </div>

      <div className="px-4 pb-3">
        <Segmented<BellTab>
          size="sm"
          grow
          value={tab}
          onChange={setTab}
          options={[
            { key: "courses", label: counts.courses > 0 ? `Courses · ${counts.courses}` : "Courses" },
            { key: "other", label: otherUnread > 0 ? `Other · ${otherUnread}` : "Other" },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border">
        {isLoading ? (
          <div className="space-y-4 px-4 py-4" aria-label="Loading notifications">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3.5">
                <div className="size-10 shrink-0 rounded-[10px] bg-surface-sunken" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-2.5 w-1/3 rounded bg-surface-sunken" />
                  <div className="h-3 w-3/4 rounded bg-surface-sunken" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/[0.12] text-primary">
              <HugeiconsIcon icon={Notification03Icon} className="size-5" />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-foreground">
              {tab === "courses" ? "No course updates yet" : "Nothing else to report"}
            </p>
            <p className="mt-1 max-w-[16rem] text-[13px] leading-relaxed text-muted-foreground">
              {tab === "courses"
                ? "New lessons, live classes, grades and certificates from your programs land here."
                : "Payments, refunds and account changes show up here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((n) => (
              <NotificationRow key={n.id} notification={n} onOpen={onOpen} compact />
            ))}
          </div>
        )}
      </div>

      <Link
        href="/dashboard/notifications"
        onClick={onClose}
        className="flex h-11 shrink-0 items-center justify-center gap-1.5 border-t border-border text-[13px] font-medium text-foreground transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
      >
        See all notifications
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
      </Link>
    </div>
  )
}

export function NotificationBell() {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => getMyNotifications(BELL_LIMIT),
    staleTime: 30_000,
    refetchInterval: 120_000, // slow polling fallback; Ably invalidates live
  })

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

  const handleOpen = React.useCallback(
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
      className="ws-touch-target relative flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      {/* Same glyph set and 18px size as the rest of the top bar's targets. */}
      <HugeiconsIcon icon={Notification03Icon} className="size-[18px]" />
      {unreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold tabular-nums text-primary-foreground ring-2 ring-background">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  )

  const panel = (
    <BellPanel feed={data} isLoading={isLoading} onOpen={handleOpen} onClose={() => setOpen(false)} />
  )

  /* Mobile: the hub rises from the bottom edge — a navigation surface. */
  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{triggerButton}</div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" showCloseButton={false} className="rounded-t-[20px] p-0">
            <SheetTitle className="sr-only">Notifications</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="focus:outline-none" render={triggerButton} />
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-[16px] p-0"
      >
        {panel}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
