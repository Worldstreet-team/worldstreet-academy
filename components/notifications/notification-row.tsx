"use client"

import Image from "next/image"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  Certificate01Icon,
  Mortarboard01Icon,
  Notification03Icon,
  PlayCircleIcon,
  Task01Icon,
  TaskDone01Icon,
  UserMultiple02Icon,
  Video01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import type { NotificationItem } from "@/lib/actions/notifications"
import { CATEGORY_LABEL } from "@/lib/notification-categories"
import { cn } from "@/lib/utils"

/* ── What a notification is about — the glyph and the eyebrow label ───────── */

type Kind = { label: string; icon: typeof BookOpen01Icon }

const KINDS = {
  lesson: { label: "New lesson", icon: PlayCircleIcon },
  assignment: { label: "Assignment", icon: Task01Icon },
  exam: { label: "Exam", icon: TaskDone01Icon },
  certificate: { label: "Certificate", icon: Certificate01Icon },
  mentorship: { label: "Mentorship", icon: UserMultiple02Icon },
  liveClass: { label: "Live class", icon: Video01Icon },
  program: { label: "Program", icon: BookOpen01Icon },
  payment: { label: "Payment", icon: Wallet01Icon },
  application: { label: "Teaching", icon: Mortarboard01Icon },
  account: { label: "Account", icon: Notification03Icon },
} satisfies Record<string, Kind>

/**
 * Presentation only: the stored `type` is coarse (course / meeting / payment…),
 * so the row reads the title the sender wrote to pick a sharper label.
 */
export function kindOf(n: Pick<NotificationItem, "type" | "title">): Kind {
  const t = n.title.toLowerCase()
  if (n.type === "payment") return KINDS.payment
  if (n.type === "application") return KINDS.application
  if (n.type === "system") return KINDS.account
  if (/mentorship|roadmap|session/.test(t)) return KINDS.mentorship
  if (n.type === "meeting" || /live class|class starts|class reminder/.test(t)) return KINDS.liveClass
  if (/certificate/.test(t)) return KINDS.certificate
  if (/assignment|submission/.test(t)) return KINDS.assignment
  if (/exam|passed|knowledge check|quiz/.test(t)) return KINDS.exam
  if (/lesson/.test(t)) return KINDS.lesson
  return KINDS.program
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.floor((now - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Day buckets for the inbox, newest first. */
export function dayBucket(iso: string, now = new Date()): "Today" | "Yesterday" | "This week" | "Earlier" {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const at = new Date(iso).getTime()
  if (at >= startOfToday) return "Today"
  if (at >= startOfToday - 86_400_000) return "Yesterday"
  if (at >= startOfToday - 6 * 86_400_000) return "This week"
  return "Earlier"
}

/* ── The row ────────────────────────────────────────────────────────────── */

/**
 * One notification. Course activity shows the program's cover with a small
 * kind badge and the program's name as the eyebrow; everything else shows a
 * plain icon chip labelled by category.
 */
export function NotificationRow({
  notification: n,
  onOpen,
  compact = false,
}: {
  notification: NotificationItem
  onOpen: (n: NotificationItem) => void
  /** The bell's denser variant: one line of body. */
  compact?: boolean
}) {
  const kind = kindOf(n)
  const eyebrow = n.course?.title ?? CATEGORY_LABEL[n.category]

  const content = (
    <>
      <span className="relative mt-0.5 shrink-0">
        {n.course?.thumbnailUrl ? (
          <span className="relative block size-10 overflow-hidden rounded-[10px] bg-surface-sunken">
            <Image src={n.course.thumbnailUrl} alt="" fill sizes="40px" className="object-cover" />
          </span>
        ) : (
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-[10px]",
              n.category === "courses" ? "bg-primary/[0.12] text-primary" : "bg-surface-sunken text-muted-foreground"
            )}
          >
            <HugeiconsIcon icon={kind.icon} className="size-[18px]" />
          </span>
        )}
        {n.course?.thumbnailUrl && (
          <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-card text-primary ring-2 ring-card">
            <HugeiconsIcon icon={kind.icon} className="size-3" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="truncate font-medium">{eyebrow}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{kind.label}</span>
        </span>
        <span className="mt-0.5 flex items-start gap-2">
          <span
            className={cn(
              "min-w-0 text-[14px] leading-snug text-foreground",
              n.read ? "font-medium" : "font-semibold",
              compact ? "truncate" : "line-clamp-2"
            )}
          >
            {n.title}
          </span>
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[13px] leading-snug text-muted-foreground",
            compact ? "line-clamp-1" : "line-clamp-2"
          )}
        >
          {n.body}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
        <time dateTime={n.createdAt} className="text-[12px] tabular-nums text-muted-foreground">
          {timeAgo(n.createdAt)}
        </time>
        {!n.read && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
      </span>
    </>
  )

  const rowClass = cn(
    "flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none",
    !n.read && "bg-primary/[0.035]"
  )

  return n.href ? (
    <Link href={n.href} className={rowClass} onClick={() => onOpen(n)}>
      {content}
    </Link>
  ) : (
    <button type="button" className={rowClass} onClick={() => onOpen(n)}>
      {content}
    </button>
  )
}
