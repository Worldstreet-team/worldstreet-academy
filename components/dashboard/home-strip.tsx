"use client"
import { Glyph, Award01Icon, BookOpen01Icon, Calendar03Icon, Certificate01Icon, PlayCircleIcon, Task01Icon, Tick02Icon, type IconComponent } from "@/components/icons"

import type * as React from "react"
import Link from "next/link"
import { Countdown } from "@/components/shared/countdown"
import { Skel } from "@/components/ui/system"
import type { ClassBoardEntry } from "@/lib/actions/class-board"
import type { LearningTotals } from "@/lib/dashboard-home"
import { useClassBoard, useMyCertificates, useMyPoints } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

/*
 * The hero's foot: the student's learning at a glance, as figure cells INSIDE
 * the hero card — the hub keeps its account figures inside the wallet card,
 * and one card reads as one thing. This replaced a band of stat pills and a
 * rail of action pills under the hero (2026-09-16): the rail repeated the
 * sidebar row for row, and the page opened on three bands of chrome before
 * its first list. Every figure is derived from real rows (`learningTotals`);
 * a cell that would only say zero for a package that can't back it is not
 * rendered.
 */

/* Cells share the card's width from ~672px of card width; two across below
   that. Hairlines: one above the row, one between cells, one between rows. */
const CELLS = "flex flex-wrap border-t border-border/60"
const CELL = cn(
  "flex min-w-0 basis-1/2 flex-col px-5 py-4 text-left @2xl:basis-0 @2xl:flex-1",
  "border-border/60 [&:nth-child(even)]:border-l [&:nth-child(n+3)]:border-t",
  "@2xl:[&:not(:first-child)]:border-l @2xl:[&:nth-child(n+3)]:border-t-0"
)

/**
 * An icon chip, then the figure over its label. `quiet` sets a word in the
 * figure's place — what an empty count is waiting for — in muted ink on the
 * same line height, so a row of zeros doesn't read as a report card. With
 * `href`, the cell opens the page that lists what it counts.
 */
function StatCell({
  icon,
  value,
  label,
  href,
  quiet = false,
}: {
  icon: IconComponent
  value: React.ReactNode
  label: string
  href?: string
  quiet?: boolean
}) {
  const inner = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-foreground/[0.05]">
        <Glyph icon={icon} className="h-4 w-4 text-muted-foreground" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate font-display leading-5 tabular-nums",
            quiet
              ? "text-[15px] font-medium text-muted-foreground"
              : "text-[20px] font-semibold tracking-[-0.02em]"
          )}
        >
          {value}
        </span>
        <span className="mt-1 truncate text-[12.5px] text-muted-foreground">{label}</span>
      </span>
    </span>
  )
  if (!href) return <div className={CELL}>{inner}</div>
  return (
    <Link
      href={href}
      className={cn(
        CELL,
        "transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      )}
    >
      {inner}
    </Link>
  )
}

/**
 * Figures from real rows only. Completed appears once there is one; lessons
 * once a package opens any; the next class only for packages with live
 * classes; certificates once one is earned (before that, points say more);
 * assignments only while some are open (the page decides, and the queries run
 * only then).
 */
export function HeroStats({
  totals,
  showCertificates,
  showClasses,
  toDo = 0,
}: {
  totals: LearningTotals
  showCertificates: boolean
  showClasses: boolean
  /** Open assignments and exams (assessmentCounts). */
  toDo?: number
  now?: number
}) {
  return (
    <div aria-label="Your learning at a glance" className={CELLS}>
      <StatCell icon={BookOpen01Icon} value={totals.inProgress} label="In progress" href="/dashboard/my-courses" />
      {totals.completed > 0 && (
        <StatCell icon={Tick02Icon} value={totals.completed} label="Completed" href="/dashboard/my-courses" />
      )}
      {totals.lessonsOpen > 0 && (
        <StatCell
          icon={PlayCircleIcon}
          value={
            <>
              {totals.lessonsDone}
              <span className="text-[14px] font-normal text-muted-foreground"> / {totals.lessonsOpen}</span>
            </>
          }
          label="Lessons done"
        />
      )}
      {showClasses && <NextClassStat />}
      <PointsStat />
      {toDo > 0 && (
        <StatCell icon={Task01Icon} value={toDo} label={toDo === 1 ? "Assignment due" : "Assignments due"} href="/dashboard/assignments" />
      )}
      {showCertificates && <CertificatesStat />}
    </div>
  )
}

/** Points so far; the page explains how they're earned. */
function PointsStat() {
  const { data, isLoading } = useMyPoints()
  return (
    <StatCell
      icon={Award01Icon}
      value={isLoading ? <Skel className="h-5 w-8" /> : (data?.total ?? 0).toLocaleString()}
      label={data && data.thisWeek > 0 ? `Points · +${data.thisWeek} this week` : "Points"}
      href="/dashboard/points"
    />
  )
}

/** The soonest thing across the board: a live class, the next class, else the cohort start. */
function soonest(board: ClassBoardEntry[]):
  | { kind: "live"; course: string; href: string }
  | { kind: "next" | "cohort"; course: string; name: string; at: string; href: string }
  | null {
  const live = board.find((b) => b.live)
  if (live?.live) return { kind: "live", course: live.courseTitle, href: live.live.joinHref }
  const next = board
    .filter((b) => b.next)
    .sort((a, b) => (a.next as { startsAt: string }).startsAt.localeCompare((b.next as { startsAt: string }).startsAt))[0]
  if (next?.next) return { kind: "next", course: next.courseTitle, name: "", at: next.next.startsAt, href: "/dashboard/meetings" }
  const cohort = board.find((b) => b.cohortStartsAt)
  if (cohort?.cohortStartsAt) return { kind: "cohort", course: cohort.courseTitle, name: cohort.cohortName ?? "your cohort", at: cohort.cohortStartsAt, href: "/dashboard" }
  return null
}

/** The next live class as a running countdown — "None scheduled" only when there truly is none. */
function NextClassStat() {
  const { data: board = [], isLoading } = useClassBoard()
  const s = soonest(board)
  if (isLoading) return <StatCell icon={Calendar03Icon} value={<Skel className="h-5 w-16" />} label="Next live class" />
  if (!s) return <StatCell icon={Calendar03Icon} value="None scheduled" label="Next live class" href="/dashboard/meetings" quiet />
  if (s.kind === "live") {
    return (
      <StatCell
        icon={Calendar03Icon}
        value={
          <span className="inline-flex items-center gap-2 text-ws-danger">
            <span aria-hidden className="size-2 rounded-full bg-ws-danger" />
            Live now
          </span>
        }
        label={s.course}
        href={s.href}
      />
    )
  }
  return (
    <StatCell
      icon={Calendar03Icon}
      value={<Countdown target={s.at} variant="compact" className="text-[17px]" endedLabel="Starting now" />}
      label={s.kind === "cohort" ? `Until ${s.name} begins` : `Next class · ${s.course}`}
      href={s.href}
    />
  )
}

/** Only once one is earned — before that the cell said "On completion", which the points beside it now outrank. */
function CertificatesStat() {
  const { data: certificates = [], isLoading } = useMyCertificates()
  if (isLoading || certificates.length === 0) return null
  return (
    <StatCell
      icon={Certificate01Icon}
      value={certificates.length}
      label={certificates.length === 1 ? "Certificate" : "Certificates"}
      href="/dashboard/certificates"
    />
  )
}

/** The foot's shape while enrollments load. */
export function HeroStatsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your progress" className={CELLS}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={CELL}>
          <div className="flex items-center gap-3">
            <Skel className="h-8 w-8 shrink-0 rounded-[9px]" />
            <div className="flex flex-col">
              <Skel className="h-5 w-10" />
              <Skel className="mt-1.5 h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
