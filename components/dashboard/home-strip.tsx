"use client"

import type * as React from "react"
import Link from "next/link"
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

/** One figure over its label. With `href`, the cell opens the page that lists what it counts. */
function StatCell({ value, label, href }: { value: React.ReactNode; label: string; href?: string }) {
  const inner = (
    <>
      <span className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
        {value}
      </span>
      <span className="mt-2 truncate text-[12.5px] text-muted-foreground">{label}</span>
    </>
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
      <StatCell value={totals.inProgress} label="In progress" href="/dashboard/my-courses" />
      {totals.completed > 0 && <StatCell value={totals.completed} label="Completed" href="/dashboard/my-courses" />}
      {totals.lessonsOpen > 0 && (
        <StatCell
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

function CertificatesStat() {
  const { data: certificates = [], isLoading } = useMyCertificates()
  return (
    <StatCell
      value={isLoading ? <Skel className="h-5 w-8" /> : certificates.length}
      label={certificates.length === 1 ? "Certificate" : "Certificates"}
      href="/dashboard/certificates"
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
  return (
    <StatCell
      value={isLoading ? <Skel className="h-5 w-8" /> : more ? `${ahead.length}+` : ahead.length}
      label={ahead.length === 1 && !more ? "Upcoming class" : "Upcoming classes"}
      href="/dashboard/meetings"
    />
  )
}

/** The foot's shape while enrollments load. */
export function HeroStatsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your progress" className={CELLS}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={CELL}>
          <Skel className="h-5 w-10" />
          <Skel className="mt-2.5 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
