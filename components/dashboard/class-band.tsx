"use client"

import * as React from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { CalendarAdd01Icon, PlayCircle02Icon } from "@hugeicons/core-free-icons"
import { Countdown } from "@/components/shared/countdown"
import { Button } from "@/components/ui/button"
import { CardShell, Eyebrow } from "@/components/ui/system"
import type { BoardClass, ClassBoardEntry } from "@/lib/actions/class-board"
import { COHORT_DATE_LABEL } from "@/lib/cohort"
import { HOST_EARLY_START_MS } from "@/lib/class-schedule"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { cn } from "@/lib/utils"

/*
 * Live classes on the student home (owner meeting 2026-10-03; Owen,
 * 2026-10-06: "a time counting down to the next class… each program is a
 * cohort"). Three pieces, all fed by getMyClassBoard:
 *   ClassBand        the hero's band for the program on screen — live now,
 *                    the next class with a countdown, or the cohort start
 *   LiveClassBanner  the page's banner while any of the learner's classes is live
 *   classTabBadge    the marker on a program tab (live dot, "in 2d")
 * Red is the live signal only (a static dot, no pulse); gold stays the action.
 */

/** "Tue 7 Oct, 6:00 PM WAT" in the learner's own zone. Client-only data, so no hydration drift. */
function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso))
}

function LiveDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full bg-ws-danger", className)} />
}

/* ── Add to calendar: a one-event .ics built in the browser ─────────────── */

const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n")
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

function downloadIcs({ uid, title, startsAt, minutes, description }: {
  uid: string
  title: string
  startsAt: string
  minutes: number
  description: string
}) {
  const start = new Date(startsAt)
  const end = new Date(start.getTime() + minutes * 60_000)
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WorldStreet Mastery Academy//Classes//EN",
    "BEGIN:VEVENT",
    `UID:${uid}@academy.worldstreetgold.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "class"}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function AddToCalendar({ uid, title, startsAt, minutes = 60, href }: {
  uid: string
  title: string
  startsAt: string
  minutes?: number
  href: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="rounded-full"
      onClick={() =>
        downloadIcs({
          uid,
          title,
          startsAt,
          minutes,
          description: `Join from your WorldStreet Mastery Academy dashboard: ${window.location.origin}${href}`,
        })
      }
    >
      <HugeiconsIcon icon={CalendarAdd01Icon} className="h-4 w-4" aria-hidden />
      Add to calendar
    </Button>
  )
}

/* ── The hero band ──────────────────────────────────────────────────────── */

/** Big countdown tiles on the hero's surface. */
const BAND_BLOCKS =
  "min-w-[3.6rem] bg-foreground/[0.05] px-2.5 py-2 sm:min-w-16 [&>span:first-child]:text-[24px] sm:[&>span:first-child]:text-[28px] [&>span:first-child]:font-semibold [&>span:last-child]:mt-0.5"

function BandShell({ children, live = false }: { children: React.ReactNode; live?: boolean }) {
  return (
    <section
      aria-label="Your live class"
      className={cn(
        "grid gap-5 border-t border-border/60 px-5 py-5 sm:px-6 @2xl:grid-cols-[minmax(0,1fr)_auto_auto] @2xl:items-center @2xl:gap-8 @2xl:px-8",
        live && "bg-ws-danger/[0.06]"
      )}
    >
      {children}
    </section>
  )
}

function ClassLine({ c, eyebrow, live = false }: { c: BoardClass; eyebrow: React.ReactNode; live?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Eyebrow className={cn("inline-flex items-center gap-2", live && "text-ws-danger")}>{eyebrow}</Eyebrow>
      <p className="line-clamp-2 font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] @2xl:line-clamp-1">{c.title}</p>
      <p className="truncate text-[13px] text-muted-foreground tabular-nums">
        {live ? "Started" : whenLabel(c.startsAt)}
        {live ? ` ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(c.startsAt))}` : ""}
        {c.hostName ? ` · with ${c.hostName}` : ""}
      </p>
    </div>
  )
}

function NextClassBand({ entry, c }: { entry: ClassBoardEntry; c: BoardClass }) {
  const queryClient = useQueryClient()
  const at = new Date(c.startsAt).getTime()
  // The join door opens with the host's early-start window; the meetings page
  // tells a learner who is early that the class hasn't begun.
  const [open, setOpen] = React.useState(() => at - Date.now() <= HOST_EARLY_START_MS)
  const [started, setStarted] = React.useState(() => at <= Date.now())
  React.useEffect(() => {
    if (open) return
    const t = setTimeout(() => setOpen(true), Math.max(0, at - HOST_EARLY_START_MS - Date.now()))
    return () => clearTimeout(t)
  }, [at, open])

  return (
    <BandShell>
      <ClassLine c={c} eyebrow="Next live class" />
      {started ? (
        <p className="text-[14px] font-medium text-muted-foreground">Starting now — waiting for your tutor</p>
      ) : (
        <Countdown
          target={c.startsAt}
          variant="blocks"
          label={`Time until ${c.title} begins`}
          blockClassName={BAND_BLOCKS}
          onEnd={() => {
            setStarted(true)
            void queryClient.invalidateQueries({ queryKey: queryKeys.classBoard })
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-2 @2xl:flex-col @2xl:items-stretch">
        {open ? (
          <Button className="rounded-full" render={<Link href={c.joinHref} />}>
            Join class
          </Button>
        ) : (
          <Button variant="outline" className="rounded-full" disabled title="Opens 15 minutes before the class">
            Join opens 15 min before
          </Button>
        )}
        <AddToCalendar uid={c.id} title={`${entry.courseTitle}: ${c.title}`} startsAt={c.startsAt} href={c.joinHref} />
      </div>
    </BandShell>
  )
}

/**
 * The band for the program the hero shows. Nothing for a program without live
 * classes in the learner's plan (the board omits it) or with nothing to say.
 */
export function ClassBand({ entry }: { entry: ClassBoardEntry | undefined }) {
  if (!entry) return null

  if (entry.live) {
    return (
      <BandShell live>
        <ClassLine
          c={entry.live}
          live
          eyebrow={
            <>
              <LiveDot />
              Live now
            </>
          }
        />
        <p className="text-[14px] text-muted-foreground">Your class is running — come in.</p>
        <Button className="rounded-full" render={<Link href={entry.live.joinHref} />}>
          Join class
        </Button>
      </BandShell>
    )
  }

  if (entry.next) return <NextClassBand key={entry.next.id} entry={entry} c={entry.next} />

  if (entry.cohortStartsAt) {
    return (
      <BandShell>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Eyebrow>Your cohort</Eyebrow>
          <p className="font-display text-[18px] font-semibold leading-snug tracking-[-0.01em]">
            Live classes begin {COHORT_DATE_LABEL}
          </p>
          <p className="text-[13px] text-muted-foreground">
            Your tutor will schedule the first class — it appears here with its own countdown.
          </p>
        </div>
        <Countdown
          target={entry.cohortStartsAt}
          variant="blocks"
          label="Time until your cohort begins"
          blockClassName={BAND_BLOCKS}
        />
        <AddToCalendar
          uid={`cohort-${entry.courseId}`}
          title={`${entry.courseTitle}: live cohort begins`}
          startsAt={entry.cohortStartsAt}
          href="/dashboard"
        />
      </BandShell>
    )
  }

  if (entry.latestRecording) {
    return (
      <BandShell>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Eyebrow>No class scheduled yet</Eyebrow>
          <p className="truncate font-display text-[18px] font-semibold leading-snug tracking-[-0.01em]">
            Catch up on {entry.latestRecording.title}
          </p>
          <p className="text-[13px] text-muted-foreground">Your next class will appear here with a countdown.</p>
        </div>
        <span className="hidden @2xl:block" />
        <Button variant="outline" className="rounded-full" render={<Link href={entry.latestRecording.href} />}>
          <HugeiconsIcon icon={PlayCircle02Icon} className="h-4 w-4" aria-hidden />
          Watch last class
        </Button>
      </BandShell>
    )
  }

  return null
}

/* ── Tab marker ─────────────────────────────────────────────────────────── */

const WEEK_MS = 7 * 24 * 3600 * 1000

/** A program tab's marker: a live dot, or how soon its next class is (within the week). */
export function classTabBadge(entry: ClassBoardEntry | undefined, now: number): React.ReactNode {
  if (!entry) return undefined
  if (entry.live) {
    return (
      <>
        <LiveDot className="size-1.5" />
        <span className="sr-only">live now</span>
      </>
    )
  }
  if (entry.next && new Date(entry.next.startsAt).getTime() - now < WEEK_MS) {
    return (
      <Countdown
        target={entry.next.startsAt}
        variant="short"
        prefix="in "
        className="text-[10.5px] font-medium text-muted-foreground"
      />
    )
  }
  return undefined
}

/* ── Page banner ────────────────────────────────────────────────────────── */

/** While any of the learner's classes is live: one line across the top of the home. */
export function LiveClassBanner({ board }: { board: ClassBoardEntry[] }) {
  const live = board.filter((e) => e.live)
  if (live.length === 0) return null
  const first = live[0]
  const room = first.live as BoardClass
  return (
    <CardShell className="border border-ws-danger/30 bg-ws-danger/[0.07]">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <LiveDot className="mt-1.5" />
          <div className="flex min-w-0 flex-col">
            <p className="line-clamp-2 text-[15px] font-semibold sm:line-clamp-1">
              {first.courseTitle} is live now
              {live.length > 1 ? <span className="font-normal text-muted-foreground"> · +{live.length - 1} more</span> : null}
            </p>
            <p className="truncate text-[13px] text-muted-foreground">
              {room.title}
              {room.hostName ? ` · with ${room.hostName}` : ""}
            </p>
          </div>
        </div>
        <Button className="rounded-full sm:shrink-0" render={<Link href={room.joinHref} />}>
          Join class
        </Button>
      </div>
    </CardShell>
  )
}
