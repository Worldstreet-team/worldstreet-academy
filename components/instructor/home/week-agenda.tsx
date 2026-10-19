"use client"
import { ArrowRight } from "@/components/icons"

import Link from "next/link"

import { CardShell } from "@/components/ui/system"
import { Countdown } from "@/components/shared/countdown"
import type { HomeEntry } from "@/lib/actions/teaching-home"
import { hostMayStart } from "@/lib/class-schedule"
import { agendaDays, timeLabel, type AgendaDay } from "@/lib/teaching-home"
import { cn } from "@/lib/utils"

/*
 * "Upcoming classes" (institutional blueprint §16, beside "Today's classes"):
 * seven local days from today — the classes the tutor hosts and their
 * confirmed mentorship sessions. Seven columns once the card is ~900px
 * wide; below that a list of the days that have something (today always
 * shows), so a phone never scrolls sideways. Today's upcoming items count down.
 */

const CALENDAR_HREF = "/instructor/calendar"

function EntryRow({ entry, now, isToday }: { entry: HomeEntry; now: number; isToday: boolean }) {
  const live = entry.state === "live"
  const ended = entry.state === "ended"
  const startable = live || (entry.state === "upcoming" && hostMayStart(entry.start, now))
  const title = entry.kind === "class" ? entry.title : `Mentorship · ${entry.studentName ?? "Student"}`
  const meta = [entry.kind === "class" ? "Class" : "1-on-1", entry.courseTitle].filter(Boolean).join(" · ")

  return (
    <li>
      <Link
        href={startable ? entry.joinHref : CALENDAR_HREF}
        className={cn(
          "flex min-w-0 flex-col gap-1 rounded-[9px] bg-ws-chip/60 px-3 py-2 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          ended && "opacity-60"
        )}
      >
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[12px]">
          <span className="font-semibold tabular-nums">{timeLabel(entry.start)}</span>
          {live ? (
            <span className="inline-flex items-center gap-1 font-semibold text-ws-danger">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ws-danger" />
              Live
            </span>
          ) : ended ? (
            <span className="text-muted-foreground">Done</span>
          ) : isToday ? (
            <Countdown
              target={entry.start}
              variant="compact"
              prefix="in "
              label={`Time until ${title}`}
              endedLabel={<span className="font-medium text-foreground">Now</span>}
              className="text-muted-foreground"
            />
          ) : null}
        </span>
        <span className="line-clamp-2 text-[13px] font-medium leading-snug">{title}</span>
        <span className="truncate text-[11.5px] text-muted-foreground">{meta}</span>
      </Link>
    </li>
  )
}

function dayLabel(day: AgendaDay<HomeEntry>): string {
  if (day.isToday) return "Today"
  return day.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
}

export function WeekAgenda({ entries, now }: { entries: HomeEntry[]; now: number }) {
  const days = agendaDays(entries, now)
  const total = days.reduce((n, d) => n + d.entries.length, 0)
  const phoneDays = days.filter((d) => d.isToday || d.entries.length > 0)

  return (
    <CardShell className="@container">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[15px] font-semibold leading-tight">Upcoming classes</h2>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {total === 0 ? "Nothing scheduled in the next 7 days" : `${total} in the next 7 days`}
          </span>
        </div>
        <Link
          href={CALENDAR_HREF}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Open calendar
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </div>

      {/* A wide card: seven columns, today first. */}
      <ol className="hidden grid-cols-7 border-t border-border/60 @4xl:grid">
        {days.map((day) => (
          <li key={day.key} className="flex min-w-0 flex-col gap-2 border-border/60 p-2.5 [&:not(:first-child)]:border-l">
            <span
              className={cn(
                "px-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
                day.isToday ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {dayLabel(day)}
            </span>
            {day.entries.length === 0 ? (
              <span className="px-1 text-[12px] text-muted-foreground/70">—</span>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {day.entries.map((e) => (
                  <EntryRow key={e.id} entry={e} now={now} isToday={day.isToday} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      {/* Narrower: only the days with something, so nothing scrolls sideways. */}
      <ol className="flex flex-col divide-y divide-border/60 border-t border-border/60 @4xl:hidden">
        {phoneDays.map((day) => (
          <li key={day.key} className="flex flex-col gap-2 px-4 py-3 sm:px-5">
            <span className={cn("text-[12.5px] font-semibold", day.isToday ? "text-foreground" : "text-muted-foreground")}>
              {day.isToday
                ? "Today"
                : day.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </span>
            {day.entries.length === 0 ? (
              <span className="text-[12.5px] text-muted-foreground">Nothing today</span>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5 @lg:grid-cols-2 @2xl:grid-cols-3">
                {day.entries.map((e) => (
                  <EntryRow key={e.id} entry={e} now={now} isToday={day.isToday} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </CardShell>
  )
}
