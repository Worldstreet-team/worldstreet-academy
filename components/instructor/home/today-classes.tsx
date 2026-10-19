"use client"

import Link from "next/link"

import { Countdown } from "@/components/shared/countdown"
import { CardShell } from "@/components/ui/system"
import type { HomeEntry } from "@/lib/actions/teaching-home"
import { hostMayStart } from "@/lib/class-schedule"
import { timeLabel } from "@/lib/teaching-home"
import { cn } from "@/lib/utils"

/*
 * "Today's classes": today's slice of the week agenda as a short list, so the
 * tutor sees what is on and when to start without reading seven columns. Live
 * rows offer Rejoin, rows inside the start window offer Start, later rows
 * count down. No gold: the hero above holds it.
 */

const CALENDAR_HREF = "/instructor/calendar"

const PILL =
  "inline-flex h-8 shrink-0 items-center rounded-full border border-border px-3.5 text-[13px] font-medium transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

function TodayRow({ entry, now }: { entry: HomeEntry; now: number }) {
  const live = entry.state === "live"
  const ended = entry.state === "ended"
  const title = entry.kind === "class" ? entry.title : `Mentorship · ${entry.studentName ?? "Student"}`
  const meta = [entry.kind === "class" ? "Class" : "1-on-1", entry.courseTitle].filter(Boolean).join(" · ")

  return (
    <li className={cn("flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5", ended && "opacity-60")}>
      <span className="w-[4.5rem] shrink-0 text-[13px] font-semibold tabular-nums">{timeLabel(entry.start)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium leading-snug">{title}</span>
        <span className="truncate text-[12px] text-muted-foreground">{meta}</span>
      </span>
      {live ? (
        <span className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ws-danger">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ws-danger" />
            Live
          </span>
          <Link href={entry.joinHref} className={PILL}>
            Rejoin
          </Link>
        </span>
      ) : ended ? (
        <span className="shrink-0 text-[12.5px] text-muted-foreground">Done</span>
      ) : hostMayStart(entry.start, now) ? (
        <Link href={entry.joinHref} className={PILL}>
          Start
        </Link>
      ) : (
        <Countdown
          target={entry.start}
          variant="compact"
          prefix="in "
          label={`Time until ${title}`}
          endedLabel={<span className="font-medium text-foreground">Now</span>}
          className="shrink-0 text-[12.5px] text-muted-foreground"
        />
      )}
    </li>
  )
}

export function TodayClasses({ entries, now }: { entries: HomeEntry[]; now: number }) {
  return (
    <CardShell>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[15px] font-semibold leading-tight">Today&apos;s classes</h2>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {entries.length === 0 ? "Nothing scheduled today" : `${entries.length} today`}
          </span>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="border-t border-border/60 px-4 py-3.5 text-[13px] text-muted-foreground sm:px-5">
          No classes today.{" "}
          <Link href={CALENDAR_HREF} className="font-medium text-foreground underline-offset-4 hover:underline">
            Open calendar
          </Link>
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-border/60 border-t border-border/60">
          {entries.map((e) => (
            <TodayRow key={e.id} entry={e} now={now} />
          ))}
        </ol>
      )}
    </CardShell>
  )
}
