"use client"
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon } from "@/components/icons"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { getTeachingCalendar, type CalendarEntry } from "@/lib/actions/teaching-calendar"
import { HOST_EARLY_START_MS, hostMayStart } from "@/lib/class-schedule"
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  dayKey,
  monthGrid,
  sameMonth,
  startOfMonth,
  weekDays,
} from "@/lib/calendar-grid"
import { useClientNow } from "@/lib/hooks/use-now"
import { cn } from "@/lib/utils"

const STATE_BADGE: Record<CalendarEntry["state"], { label: string; className: string }> = {
  upcoming: { label: "Scheduled", className: "bg-ws-chip text-ws-muted" },
  live: { label: "Live", className: "bg-ws-success/10 text-ws-success" },
  ended: { label: "Done", className: "bg-ws-chip text-ws-subtle" },
  cancelled: { label: "Cancelled", className: "bg-ws-chip text-ws-subtle line-through" },
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

/** One class or session in a day's agenda, with what the tutor can do with it now. */
function AgendaItem({
  entry,
  now,
  onPlay,
}: {
  entry: CalendarEntry
  now: number
  onPlay: (rec: { id: string; title: string }) => void
}) {
  const badge = STATE_BADGE[entry.state]
  const isClass = entry.kind === "class"
  const startable = entry.state === "upcoming" && hostMayStart(entry.start, now)
  const stored = entry.recordings.filter((r) => r.status === "stored")
  const processing = entry.recordings.some((r) => r.status === "pending")
  const lost = entry.recordings.length > 0 && entry.recordings.every((r) => r.status === "failed")

  let action: React.ReactNode = null
  if (entry.joinHref && (startable || entry.state === "live")) {
    action = (
      <Button size="sm" render={<Link href={entry.joinHref} />}>
        {entry.state === "live" ? "Rejoin" : isClass ? "Start class" : "Start session"}
      </Button>
    )
  } else if (entry.state === "upcoming") {
    action = (
      <span className="text-[12px] text-ws-muted">
        Opens {timeLabel(new Date(new Date(entry.start).getTime() - HOST_EARLY_START_MS).toISOString())}
      </span>
    )
  } else if (entry.state === "ended" && isClass) {
    action =
      stored.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          {stored.map((r, i) => (
            <Button key={r.id} size="sm" variant="outline" onClick={() => onPlay(r)}>
              <PlayIcon size={12} aria-hidden />
              {stored.length > 1 ? `Part ${i + 1}` : "Recording"}
            </Button>
          ))}
        </div>
      ) : (
        <span className="text-[12px] text-ws-muted">
          {processing ? "Recording processing" : lost ? "Recording not saved" : "No recording"}
        </span>
      )
  } else if (entry.state === "ended") {
    action = <span className="text-[12px] text-ws-muted">Not recorded</span>
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md bg-ws-surface p-3">
      <div className="w-16 shrink-0 text-[12px] font-medium tabular-nums text-ws-primary">{timeLabel(entry.start)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ws-primary">
          {isClass ? entry.title : `Mentorship · ${entry.studentName ?? "Student"}`}
        </p>
        <p className="truncate text-[12px] text-ws-muted">
          {[isClass ? "Class" : "1-on-1", entry.courseTitle].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.className)}>
        {badge.label}
      </span>
      <div className="flex shrink-0 justify-end">{action}</div>
    </li>
  )
}

/**
 * The tutor's academic calendar: course classes they host (scheduled, live,
 * past, cancelled) and confirmed mentorship sessions. Month grid on md+, a
 * week agenda on phones. Laid out in the browser's time zone, which it names.
 * Start links follow joinMeeting's rule (from 15 minutes before); past classes
 * open their recording.
 */
export function TeachingCalendar({ onPlay }: { onPlay: (rec: { id: string; title: string }) => void }) {
  // Null on the server and through hydration: the grid depends on the browser's clock and zone.
  const now = useClientNow()
  const [anchor, setAnchor] = useState<Date | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const cursor = useMemo(() => anchor ?? (now !== null ? new Date(now) : null), [anchor, now])
  const grid = useMemo(() => (cursor ? monthGrid(cursor) : []), [cursor])
  const week = useMemo(() => (cursor ? weekDays(cursor) : []), [cursor])
  const from = grid[0]?.toISOString() ?? ""
  const to = grid.length ? addDays(grid[grid.length - 1], 1).toISOString() : ""

  const { data, isLoading } = useQuery({
    queryKey: ["teaching-calendar", from, to],
    queryFn: () => getTeachingCalendar({ from, to }),
    enabled: Boolean(from && to),
    refetchInterval: 60_000,
  })
  const entries = useMemo(() => (data?.success ? data.data : []), [data])
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const e of entries) {
      const key = dayKey(new Date(e.start))
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return map
  }, [entries])

  if (now === null || !cursor) {
    return <div className="h-[520px] animate-pulse rounded-[20px] bg-ws-surface motion-reduce:animate-none" />
  }

  const todayKey = dayKey(new Date(now))
  // The picked day while it is on screen; else today in its own month, else the 1st.
  const gridKeys = grid.map(dayKey)
  const activeKey =
    selectedKey && gridKeys.includes(selectedKey)
      ? selectedKey
      : sameMonth(new Date(now), cursor)
        ? todayKey
        : dayKey(startOfMonth(cursor))
  const activeDay = grid[gridKeys.indexOf(activeKey)] ?? startOfMonth(cursor)
  const activeEntries = byDay.get(activeKey) ?? []
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  const weekLabel = `${week[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${week[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`

  const navButton =
    "flex h-8 w-8 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {/* Month steps on md+, week steps on phones. */}
          <button type="button" className={cn(navButton, "hidden md:flex")} aria-label="Previous month" onClick={() => setAnchor(addMonths(startOfMonth(cursor), -1))}>
            <ChevronLeftIcon size={16} />
          </button>
          <button type="button" className={cn(navButton, "md:hidden")} aria-label="Previous week" onClick={() => setAnchor(addDays(cursor, -7))}>
            <ChevronLeftIcon size={16} />
          </button>
          <h2 className="min-w-40 text-center font-display text-[17px] font-semibold text-ws-primary">
            <span className="hidden md:inline">{monthLabel}</span>
            <span className="md:hidden tabular-nums">{weekLabel}</span>
          </h2>
          <button type="button" className={cn(navButton, "hidden md:flex")} aria-label="Next month" onClick={() => setAnchor(addMonths(startOfMonth(cursor), 1))}>
            <ChevronRightIcon size={16} />
          </button>
          <button type="button" className={cn(navButton, "md:hidden")} aria-label="Next week" onClick={() => setAnchor(addDays(cursor, 7))}>
            <ChevronRightIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setAnchor(null)
              setSelectedKey(null)
            }}
            className="ml-1 rounded-full border border-ws-hairline px-3 py-1 text-[12px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
          >
            Today
          </button>
        </div>
        <p className="text-[12px] text-ws-muted">
          Times in {timeZone}
          {isLoading && " · Loading…"}
        </p>
      </div>

      {data && !data.success && <p className="text-sm text-ws-danger">{data.error}</p>}

      {/* Month grid — md and up */}
      <div className="hidden overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface md:block">
        <div className="grid grid-cols-7 border-b border-ws-hairline">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-ws-subtle">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const key = dayKey(day)
            const dayEntries = byDay.get(key) ?? []
            const inMonth = sameMonth(day, cursor)
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                aria-pressed={key === activeKey}
                aria-label={`${day.toLocaleDateString(undefined, { dateStyle: "full" })}, ${dayEntries.length} item${dayEntries.length === 1 ? "" : "s"}`}
                className={cn(
                  "flex min-h-24 flex-col gap-1 border-b border-r border-ws-hairline p-1.5 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised [&:nth-child(7n)]:border-r-0",
                  key === activeKey && "bg-ws-raised",
                  !inMonth && "opacity-50"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[12px] tabular-nums",
                    key === todayKey ? "bg-ws-primary font-semibold text-ws-page" : "text-ws-muted"
                  )}
                >
                  {day.getDate()}
                </span>
                {dayEntries.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={cn(
                      "truncate rounded-xs px-1 py-0.5 text-[11px]",
                      e.state === "live" ? "bg-ws-success/10 text-ws-success" : "bg-ws-chip text-ws-primary",
                      e.state === "cancelled" && "line-through text-ws-subtle"
                    )}
                  >
                    <span className="tabular-nums">{timeLabel(e.start)}</span>{" "}
                    {e.kind === "class" ? e.title : "Mentorship"}
                  </span>
                ))}
                {dayEntries.length > 3 && (
                  <span className="px-1 text-[11px] text-ws-muted">+{dayEntries.length - 3} more</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day — md and up */}
      <section className="hidden space-y-2 md:block">
        <h3 className="text-sm font-semibold text-ws-primary">
          {activeDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </h3>
        {activeEntries.length === 0 ? (
          <p className="rounded-md bg-ws-surface px-4 py-4 text-[13px] text-ws-muted">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {activeEntries.map((e) => (
              <AgendaItem key={e.id} entry={e} now={now} onPlay={onPlay} />
            ))}
          </ul>
        )}
      </section>

      {/* Week agenda — phones */}
      <div className="space-y-4 md:hidden">
        {week.map((day) => {
          const key = dayKey(day)
          const dayEntries = byDay.get(key) ?? []
          return (
            <section key={key} className="space-y-2">
              <h3 className={cn("text-[13px] font-semibold", key === todayKey ? "text-ws-primary" : "text-ws-muted")}>
                {day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                {key === todayKey && " · Today"}
              </h3>
              {dayEntries.length === 0 ? (
                <p className="text-[12px] text-ws-subtle">Nothing scheduled</p>
              ) : (
                <ul className="space-y-2">
                  {dayEntries.map((e) => (
                    <AgendaItem key={e.id} entry={e} now={now} onPlay={onPlay} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
