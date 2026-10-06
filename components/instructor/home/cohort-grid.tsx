"use client"

import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"
import { CardShell, EmptyState } from "@/components/ui/system"
import { Countdown } from "@/components/shared/countdown"
import { ProgramCover } from "@/components/platform/program-bits"
import type { CohortCard } from "@/lib/actions/teaching-home"
import { cohortIsUpcoming } from "@/lib/cohort"
import { cohortStartLabel } from "@/lib/teaching-home"
import { cn } from "@/lib/utils"

/*
 * One card per course the tutor teaches — each program is a cohort. School
 * programs lead, then marketplace and New Economy courses, each labelled.
 * Every figure is a real count; a row the course can't have (mentorship
 * outside a school program) is left out rather than shown as zero.
 */

const SCHEDULE_HREF = "/instructor/meetings"
const RECORDINGS_HREF = "/instructor/calendar#recordings"
const MENTORSHIP_HREF = "/instructor/meetings#mentorship"

const RECORDING_LABEL = {
  stored: { text: "Ready", className: "text-ws-success" },
  pending: { text: "Processing", className: "text-muted-foreground" },
  failed: { text: "Failed", className: "text-ws-danger" },
} as const

const STATUS_CHIP: Partial<Record<CohortCard["status"], string>> = {
  closed: "Closed to new students",
  suspended: "Suspended",
}

const ROW = "flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-[13px]"
const VALUE_LINK =
  "inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={ROW}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-right">{children}</span>
    </div>
  )
}

function CountLink({ count, href, noun }: { count: number; href: string; noun: string }) {
  if (count === 0) return <span className="text-muted-foreground">None</span>
  return (
    <Link href={href} className={VALUE_LINK}>
      <span className="tabular-nums">{count}</span> {noun}
      <ArrowRight size={13} strokeWidth={2} aria-hidden />
    </Link>
  )
}

function NextClassValue({ card, now }: { card: CohortCard; now: number }) {
  const next = card.nextClass
  if (next?.live) {
    return (
      <Link href={`${SCHEDULE_HREF}?join=${next.id}`} className={cn(VALUE_LINK, "text-ws-danger")}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ws-danger" />
        Live now
      </Link>
    )
  }
  if (next) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-muted-foreground" title={next.title}>
          {next.title}
        </span>
        <Countdown
          target={next.start}
          variant="short"
          prefix="in "
          endedLabel="Now"
          className="shrink-0 rounded-full bg-ws-chip px-2 py-0.5 text-[12px] font-semibold"
        />
      </span>
    )
  }
  if (card.kind !== "program") return <span className="text-muted-foreground">Self-paced</span>
  return (
    <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
      <span className="text-muted-foreground">
        {cohortIsUpcoming(now) ? `None · cohort ${cohortStartLabel()}` : "None scheduled"}
      </span>
      <Link href={SCHEDULE_HREF} className={VALUE_LINK}>
        Schedule
      </Link>
    </span>
  )
}

function Cohort({ card, now }: { card: CohortCard; now: number }) {
  const recording = card.latestRecording ? RECORDING_LABEL[card.latestRecording.status] : null
  const statusChip = STATUS_CHIP[card.status]
  return (
    <CardShell>
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <ProgramCover src={card.art} sizes="44px" mark="sm" className="h-11 w-11 shrink-0 rounded-[9px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href={card.manageHref}
            className="line-clamp-2 text-[15px] font-semibold leading-snug transition-colors hover:text-muted-foreground"
          >
            {card.title}
          </Link>
          <span className="truncate text-[12px] text-muted-foreground">
            {[card.kindLabel, card.schoolName].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      {statusChip && (
        <span className="mx-4 mb-2 self-start rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {statusChip}
        </span>
      )}
      <div className="flex flex-1 flex-col divide-y divide-border/60 border-t border-border/60">
        <Row label="Students">
          <span className="font-semibold tabular-nums">{card.enrolled.toLocaleString()}</span>
        </Row>
        <Row label="Next class">
          <NextClassValue card={card} now={now} />
        </Row>
        <Row label="To grade">
          <CountLink count={card.toGrade} href={card.gradeHref} noun={card.toGrade === 1 ? "submission" : "submissions"} />
        </Row>
        {(card.kind === "program" || card.mentorshipRequests > 0) && (
          <Row label="Mentorship">
            <CountLink
              count={card.mentorshipRequests}
              href={MENTORSHIP_HREF}
              noun={card.mentorshipRequests === 1 ? "request" : "requests"}
            />
          </Row>
        )}
        <Row label="Latest recording">
          {recording ? (
            <Link href={RECORDINGS_HREF} className={cn(VALUE_LINK, recording.className)}>
              {recording.text}
              <ArrowRight size={13} strokeWidth={2} aria-hidden />
            </Link>
          ) : (
            <span className="text-muted-foreground">None yet</span>
          )}
        </Row>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-[13px]">
        {card.communityUrl ? (
          <a href={card.communityUrl} target="_blank" rel="noopener noreferrer" className={VALUE_LINK}>
            Class community
            <ExternalLink size={13} strokeWidth={2} aria-hidden />
          </a>
        ) : (
          <Link href={`${card.manageHref}/edit`} className="text-muted-foreground transition-colors hover:text-foreground">
            Add a class community
          </Link>
        )}
        <Link
          href={card.manageHref}
          className="inline-flex shrink-0 items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Manage
          <ArrowRight size={13} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </CardShell>
  )
}

export function CohortGrid({ cohorts, draftCount, now }: { cohorts: CohortCard[]; draftCount: number; now: number }) {
  return (
    <section aria-labelledby="cohorts-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <h2 id="cohorts-heading" className="text-[15px] font-semibold leading-tight">
            Your cohorts
          </h2>
          <span className="text-[13px] text-muted-foreground">Every program you teach, and what it needs from you.</span>
        </div>
        <Link
          href="/instructor/courses"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {draftCount > 0 ? `All courses · ${draftCount} draft${draftCount === 1 ? "" : "s"}` : "All courses"}
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </Link>
      </div>
      {cohorts.length === 0 ? (
        <CardShell>
          <EmptyState
            title="No published courses yet"
            description="A course becomes a cohort once it's published. Finish one and it shows up here with its classes, grading and recordings."
          />
        </CardShell>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {cohorts.map((card) => (
            <Cohort key={card.id} card={card} now={now} />
          ))}
        </div>
      )}
    </section>
  )
}
