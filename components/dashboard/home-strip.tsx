"use client"

import type * as React from "react"
import Link from "next/link"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  BookOpen01Icon,
  Calendar03Icon,
  Certificate01Icon,
  PlayCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { Skel } from "@/components/ui/system"
import { splitClasses, type LearningTotals } from "@/lib/dashboard-home"
import { useMyCertificates, useUpcomingClasses } from "@/lib/hooks/queries"
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
  icon: IconSvgElement
  value: React.ReactNode
  label: string
  href?: string
  quiet?: boolean
}) {
  const inner = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-foreground/[0.05]">
        <HugeiconsIcon icon={icon} className="h-4 w-4 text-muted-foreground" aria-hidden />
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
 * once a package opens any; certificates and classes only for packages that
 * include them (the page decides, and their queries run only then).
 */
export function HeroStats({
  totals,
  showCertificates,
  showClasses,
  now,
}: {
  totals: LearningTotals
  showCertificates: boolean
  showClasses: boolean
  now: number
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
      {showCertificates && <CertificatesStat />}
      {showClasses && <ClassesStat now={now} />}
    </div>
  )
}

/** None earned yet: the cell says when one arrives instead of printing a zero. */
function CertificatesStat() {
  const { data: certificates = [], isLoading } = useMyCertificates()
  const none = !isLoading && certificates.length === 0
  return (
    <StatCell
      icon={Certificate01Icon}
      value={isLoading ? <Skel className="h-5 w-8" /> : none ? "On completion" : certificates.length}
      label={none ? "Your certificate" : certificates.length === 1 ? "Certificate" : "Certificates"}
      href="/dashboard/certificates"
      quiet={none}
    />
  )
}

/** `getUpcomingClasses`'s own limit: a full list may have more behind it. */
const CLASS_LIST_LIMIT = 10

/**
 * Classes still ahead, read through `splitClasses` like the Upcoming classes
 * tile — one waiting for its host has started, so it isn't upcoming. A full
 * list reads "N+".
 */
function ClassesStat({ now }: { now: number }) {
  const { data: classes = [], isLoading } = useUpcomingClasses()
  const { ahead } = splitClasses(classes, now)
  const more = classes.length >= CLASS_LIST_LIMIT
  const none = !isLoading && ahead.length === 0
  return (
    <StatCell
      icon={Calendar03Icon}
      value={isLoading ? <Skel className="h-5 w-8" /> : none ? "None scheduled" : more ? `${ahead.length}+` : ahead.length}
      label={ahead.length === 1 && !more ? "Upcoming class" : "Upcoming classes"}
      href="/dashboard/meetings"
      quiet={none}
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
