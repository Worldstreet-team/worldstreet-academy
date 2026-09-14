"use client"

import { CalendarClockIcon, ChevronRightIcon } from "lucide-react"
import { useUpcomingClasses } from "@/lib/hooks/queries"

/**
 * Scheduled course classes (spec §12 "Upcoming classes") on the meetings page,
 * above Course Sessions. Renders nothing when there are none — the dashboard
 * tile carries the empty-state copy. Choosing a class runs the page's normal
 * join, which says when a class hasn't started yet.
 */
export function UpcomingClassesList({ onJoin }: { onJoin: (meetingId: string) => void }) {
  const { data: classes = [] } = useUpcomingClasses()
  // Read per render to tell a late class from a future one; the minute refetch re-renders, so staleness is bounded.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  if (classes.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ws-primary">Upcoming classes</h2>
        <span className="text-[11px] tabular-nums text-ws-muted">{classes.length} scheduled</span>
      </div>
      <ul className="space-y-1.5">
        {classes.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onJoin(c.id)}
              className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ws-brand/10">
                <CalendarClockIcon size={16} className="text-ws-gold" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ws-primary">{c.title}</span>
                <span className="block truncate text-[11px] text-ws-muted">
                  {new Date(c.scheduledAt).getTime() <= now ? (
                    "Waiting for your instructor"
                  ) : (
                    <span className="tabular-nums">
                      {new Date(c.scheduledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  )}
                  {c.courseTitle ? ` · ${c.courseTitle}` : ""}
                </span>
              </span>
              <ChevronRightIcon size={14} className="shrink-0 text-ws-subtle" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
