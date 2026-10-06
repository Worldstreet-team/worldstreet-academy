"use client"

import Link from "next/link"
import { ChevronRight, CircleCheck, ClipboardCheck, MessageCircle, UserCheck, VideoOff, type LucideIcon } from "lucide-react"
import { CardShell, EmptyState } from "@/components/ui/system"
import type { TodoItem } from "@/lib/actions/teaching-home"
import { waitedLabel } from "@/lib/teaching-home"
import { cn } from "@/lib/utils"

/*
 * One queue of what is waiting on the tutor, most urgent kind first:
 * grading, mentorship requests, unread messages, then classes whose
 * recording failed. Oldest first within a kind. Each row opens its place.
 */

type QueueRow = Omit<TodoItem, "kind"> & { kind: TodoItem["kind"] | "messages" }

const KIND: Record<QueueRow["kind"], { icon: LucideIcon; tone?: "danger" }> = {
  grade: { icon: ClipboardCheck },
  mentorship: { icon: UserCheck },
  messages: { icon: MessageCircle },
  recording: { icon: VideoOff, tone: "danger" },
}

/** The server's queue with the shell's unread count slotted in after mentorship. */
function queueRows(items: TodoItem[], unread: number): QueueRow[] {
  const messages: QueueRow[] =
    unread > 0
      ? [
          {
            key: "messages",
            kind: "messages",
            count: unread,
            title: `Reply to ${unread} unread message${unread === 1 ? "" : "s"}`,
            detail: "Inbox",
            href: "/instructor/messages",
            since: "",
          },
        ]
      : []
  const before = items.filter((i) => i.kind === "grade" || i.kind === "mentorship")
  const after = items.filter((i) => i.kind === "recording")
  return [...before, ...messages, ...after]
}

export function TodoQueue({ items, unread, now }: { items: TodoItem[]; unread: number; now: number }) {
  const rows = queueRows(items, unread)
  return (
    <CardShell>
      <div className="flex items-center gap-2.5 px-4 py-3.5 sm:px-5">
        <h2 className="text-[15px] font-semibold leading-tight">To do</h2>
        {rows.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ws-chip px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {rows.length}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="You're all caught up"
          description="Nothing to grade, confirm or answer. New submissions and requests land here."
          className="border-t border-border/60 py-8"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 border-t border-border/60">
          {rows.map((row) => {
            const { icon: Icon, tone } = KIND[row.kind]
            return (
              <li key={row.key}>
                <Link
                  href={row.href}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none sm:px-5"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]",
                      tone === "danger" ? "bg-ws-danger/10 text-ws-danger" : "bg-ws-chip text-muted-foreground"
                    )}
                  >
                    <Icon size={17} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-medium">{row.title}</span>
                    <span className="truncate text-[12.5px] text-muted-foreground">
                      {[row.detail, row.since ? waitedLabel(row.since, now) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ChevronRight size={16} strokeWidth={2} aria-hidden className="shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </CardShell>
  )
}
