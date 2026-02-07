"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
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
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Notification03Icon,
  BookOpen01Icon,
  Award02Icon,
  UserMultipleIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"

/* ── Mock notifications ───────────────────────────────────── */
type Notification = {
  id: string
  type: "course" | "achievement" | "social" | "system"
  title: string
  message: string
  time: string
  read: boolean
  avatar?: string
  href?: string
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "course",
    title: "New lesson available",
    message: "Bitcoin & Blockchain Fundamentals has a new lesson: 'Mining Explained'",
    time: "2m ago",
    read: false,
    href: "/dashboard/courses/1",
  },
  {
    id: "2",
    type: "achievement",
    title: "Achievement unlocked!",
    message: "You completed your first course. Keep going!",
    time: "1h ago",
    read: false,
  },
  {
    id: "3",
    type: "social",
    title: "Sarah Chen replied",
    message: "Great question! The answer is...",
    time: "3h ago",
    read: true,
    avatar: "/user/dashboard/course-empty-state.png",
  },
  {
    id: "4",
    type: "system",
    title: "Platform update",
    message: "We've added new features to improve your learning experience.",
    time: "1d ago",
    read: true,
  },
  {
    id: "5",
    type: "course",
    title: "Course reminder",
    message: "You haven't visited 'DeFi Yield Strategies' in 3 days.",
    time: "2d ago",
    read: true,
    href: "/dashboard/courses/2",
  },
]

const typeIcons = {
  course: BookOpen01Icon,
  achievement: Award02Icon,
  social: UserMultipleIcon,
  system: AlertCircleIcon,
}

const typeColors = {
  course: "text-primary",
  achievement: "text-orange-500",
  social: "text-blue-500",
  system: "text-muted-foreground",
}

/* ── Shared notification list ────────────────────────────── */
function NotificationList({
  notifications,
  onMarkAllRead,
  onClear,
}: {
  notifications: Notification[]
  onMarkAllRead: () => void
  onClear: () => void
}) {
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col">
      {/* Header actions */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </span>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-[11px] text-primary hover:underline px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <Separator />

      {/* Items */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="relative w-28 h-28 mb-2">
            <Image
              src="/user/dashboard/notification-bell-empty-state.png"
              alt="No notifications"
              fill
              className="object-contain"
              sizes="112px"
            />
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
              const Icon = typeIcons[notification.type]
              const colorClasses = typeColors[notification.type]

              const content = (
                <div
                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                    !notification.read ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <div
                    className={`shrink-0 ${colorClasses}`}
                  >
                    <HugeiconsIcon icon={Icon} size={18} />
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
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {notification.time}
                    </p>
                  </div>
                </div>
              )

              return notification.href ? (
                <Link key={notification.id} href={notification.href} className="block">
                  {content}
                </Link>
              ) : (
                <div key={notification.id}>{content}</div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

/* ── Main component ──────────────────────────────────────── */
export function NotificationBell() {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const [notifications, setNotifications] =
    React.useState<Notification[]>(MOCK_NOTIFICATIONS)

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleClear = () => {
    setNotifications([])
  }

  const triggerButton = (
    <button
      type="button"
      className="relative flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted transition-colors"
      aria-label="Notifications"
    >
      <HugeiconsIcon icon={Notification03Icon} size={16} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
          {unreadCount}
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
            className="rounded-t-2xl p-0 max-h-[85svh]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
            </div>
            <SheetHeader className="px-4 pb-2 pt-1">
              <SheetTitle className="text-base flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </SheetTitle>
            </SheetHeader>
            <NotificationList
              notifications={notifications}
              onMarkAllRead={handleMarkAllRead}
              onClear={handleClear}
            />
          </SheetContent>
        </Sheet>
      </>
    )
  }

  /* ── Desktop: DropdownMenu as popover ── */
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="focus:outline-none"
        render={triggerButton}
      />
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
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>
        <NotificationList
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
          onClear={handleClear}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
