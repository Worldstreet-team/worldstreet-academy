"use client"

import * as React from "react"
import Image from "next/image"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { CardShell, EmptyState, Eyebrow, PageHeader, Segmented } from "@/components/ui/system"
import { NotificationRow, dayBucket } from "@/components/notifications/notification-row"
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/actions/notifications"
import type { NotificationCategory } from "@/lib/notification-categories"
import { queryKeys } from "@/lib/hooks/queries/keys"
import type { SSEEventPayload } from "@/lib/call-events"
import { cn } from "@/lib/utils"

/**
 * The full inbox. Course activity leads (the default tab), filterable by
 * program; payments and account housekeeping have their own tabs. Rows group
 * by day so "what happened since I was last here" reads at a glance.
 *
 * The query key extends the bell's `["notifications"]` prefix, so the bell's
 * invalidations (mark read, Ably `notification:new`) refresh this page too.
 */
const inboxKey = [...queryKeys.notifications, "inbox"] as const
const INBOX_LIMIT = 100

type Tab = NotificationCategory | "all"

const DAY_ORDER = ["Today", "Yesterday", "This week", "Earlier"] as const

const EMPTY_COPY: Record<Tab, { title: string; description: string }> = {
  courses: {
    title: "No course updates yet",
    description: "New lessons, live classes, grades, certificates and mentorship updates from your programs land here.",
  },
  payments: {
    title: "No payment activity",
    description: "Purchases, refunds, deposits and withdrawals show up here.",
  },
  account: {
    title: "Nothing about your account",
    description: "Instructor applications and account changes show up here.",
  },
  all: {
    title: "No notifications yet",
    description: "Activity from your programs, payments and account will land here.",
  },
}

function RowSkeleton() {
  return (
    <div className="flex items-start gap-3.5 px-4 py-3.5">
      <div className="size-10 shrink-0 rounded-[10px] bg-surface-sunken" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-2.5 w-1/4 rounded bg-surface-sunken" />
        <div className="h-3 w-2/3 rounded bg-surface-sunken" />
        <div className="h-2.5 w-1/2 rounded bg-surface-sunken" />
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = React.useState<Tab>("courses")
  const [program, setProgram] = React.useState<string>("all")
  const [unreadOnly, setUnreadOnly] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: inboxKey,
    queryFn: () => getMyNotifications(INBOX_LIMIT),
    staleTime: 30_000,
  })

  const notifications = React.useMemo(() => data?.notifications ?? [], [data])
  const counts = data?.unreadByCategory ?? { courses: 0, payments: 0, account: 0 }
  const tabUnread = tab === "all" ? (data?.unreadCount ?? 0) : counts[tab]

  const inTab = React.useMemo(
    () => (tab === "all" ? notifications : notifications.filter((n) => n.category === tab)),
    [notifications, tab]
  )

  // Programs present in this tab, most recent activity first.
  const programs = React.useMemo(() => {
    const seen = new Map<string, NonNullable<NotificationItem["course"]>>()
    for (const n of inTab) if (n.course && !seen.has(n.course.id)) seen.set(n.course.id, n.course)
    return [...seen.values()]
  }, [inTab])

  const activeProgram = programs.some((p) => p.id === program) ? program : "all"

  const groups = React.useMemo(() => {
    const now = new Date()
    const visible = inTab.filter(
      (n) => (activeProgram === "all" || n.course?.id === activeProgram) && (!unreadOnly || !n.read)
    )
    const byDay = new Map<(typeof DAY_ORDER)[number], NotificationItem[]>()
    for (const n of visible) {
      const day = dayBucket(n.createdAt, now)
      byDay.set(day, [...(byDay.get(day) ?? []), n])
    }
    return DAY_ORDER.filter((d) => byDay.has(d)).map((d) => ({ day: d, items: byDay.get(d)! }))
  }, [inTab, activeProgram, unreadOnly])

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

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(tab === "all" ? undefined : tab),
    // Prefix invalidation refreshes both the bell and this inbox.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
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

  const withCount = (label: string, n: number) => (n > 0 ? `${label} · ${n}` : label)
  const empty = unreadOnly
    ? { title: "You're all caught up", description: "Everything here has been read." }
    : EMPTY_COPY[tab]

  return (
    <>
      <Topbar title="Notifications" />
      <div className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <PageHeader
            title="Notifications"
            subtitle="What's happening in your programs — new lessons, live classes, grades, certificates and mentorship."
            actions={
              <Button
                variant="ghost"
                className="h-9 px-3 text-[13px]"
                disabled={tabUnread === 0 || markAll.isPending}
                onClick={() => markAll.mutate()}
              >
                {markAll.isPending ? "Marking…" : "Mark all read"}
              </Button>
            }
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Segmented<Tab>
                value={tab}
                onChange={(next) => {
                  setTab(next)
                  setProgram("all")
                }}
                options={[
                  { key: "courses", label: withCount("Courses", counts.courses) },
                  { key: "payments", label: withCount("Payments", counts.payments) },
                  { key: "account", label: withCount("Account", counts.account) },
                  { key: "all", label: "All" },
                ]}
              />
            </div>
            <button
              type="button"
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly((v) => !v)}
              className={cn(
                "h-9 shrink-0 self-start rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:self-auto",
                unreadOnly
                  ? "border-transparent bg-accent text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              Unread only
            </button>
          </div>

          {programs.length > 1 && (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="flex w-max gap-2" role="group" aria-label="Filter by program">
                <button
                  type="button"
                  aria-pressed={activeProgram === "all"}
                  onClick={() => setProgram("all")}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    activeProgram === "all"
                      ? "bg-foreground text-background"
                      : "bg-surface-sunken text-muted-foreground hover:text-foreground"
                  )}
                >
                  All programs
                </button>
                {programs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={activeProgram === p.id}
                    onClick={() => setProgram(p.id)}
                    title={p.title}
                    className={cn(
                      "flex h-9 max-w-[16rem] items-center gap-2 rounded-full pl-1.5 pr-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      activeProgram === p.id
                        ? "bg-foreground text-background"
                        : "bg-surface-sunken text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="relative size-6 shrink-0 overflow-hidden rounded-full bg-card">
                      {p.thumbnailUrl && (
                        <Image src={p.thumbnailUrl} alt="" fill sizes="24px" className="object-cover" />
                      )}
                    </span>
                    <span className="truncate">{p.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <CardShell className="divide-y divide-border/60 overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <RowSkeleton key={i} />
              ))}
            </CardShell>
          ) : groups.length === 0 ? (
            <CardShell>
              <EmptyState illustration="noNotifications" title={empty.title} description={empty.description} />
            </CardShell>
          ) : (
            <div className="space-y-6">
              {groups.map(({ day, items }) => (
                <section key={day} aria-label={day} className="space-y-2.5">
                  <Eyebrow className="px-1">{day}</Eyebrow>
                  <CardShell className="divide-y divide-border/60 overflow-hidden">
                    {items.map((n) => (
                      <NotificationRow key={n.id} notification={n} onOpen={handleOpen} />
                    ))}
                  </CardShell>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
