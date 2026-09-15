"use client"

import type * as React from "react"
import {
  BookOpen01Icon,
  Calendar03Icon,
  Certificate01Icon,
  CheckmarkCircle02Icon,
  Message01Icon,
  PlayCircleIcon,
  Search01Icon,
  Task01Icon,
  TeacherIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons"
import { glyph, type Glyph } from "@/components/dashboard/tile-bits"
import { ActionPill, Skel } from "@/components/ui/system"
import type { LearningTotals } from "@/lib/dashboard-home"
import { useMyCertificates, useUpcomingClasses } from "@/lib/hooks/queries"

/*
 * Under the hero: the stat strip (the hub's value-carrying network strip) and
 * the ActionPill rail. Stats are facts, so their chips are neutral and still;
 * actions are verbs, so theirs are gold and pressable.
 */

const InProgressGlyph = glyph(BookOpen01Icon)
const CompletedGlyph = glyph(CheckmarkCircle02Icon)
const LessonsGlyph = glyph(PlayCircleIcon)
const CertificateGlyph = glyph(Certificate01Icon)
const ClassesGlyph = glyph(Calendar03Icon)

const BrowseGlyph = glyph(Search01Icon)
const AssignmentsGlyph = glyph(Task01Icon)
const MessagesGlyph = glyph(Message01Icon)
const MeetingsGlyph = glyph(Video01Icon)
const MentorshipGlyph = glyph(TeacherIcon)

/** A pill of one fact: 28px icon chip, figure over label. Separated by fill in dark, hairline on paper — the card rule. */
function StatChip({ icon: Icon, value, label }: { icon: Glyph; value: React.ReactNode; label: string }) {
  return (
    <li className="flex min-h-14 min-w-0 items-center gap-3 rounded-full border border-border bg-card py-2 pl-2 pr-5 dark:border-transparent @2xl:flex-1 @2xl:basis-44">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]">
        <Icon className="h-[15px] w-[15px] text-muted-foreground" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[15px] font-semibold tabular-nums">{value}</span>
        <span className="truncate text-[12.5px] text-muted-foreground">{label}</span>
      </span>
    </li>
  )
}

/* Two across on a phone (an odd last chip spans the row, so there is never a
   hole); from ~672px of page width the chips share rows and stretch. */
const STRIP = "grid grid-cols-2 gap-2 @2xl:flex @2xl:flex-wrap [&>li:last-child:nth-child(odd)]:col-span-2"

/**
 * Figures from real rows only. Completed appears once there is one; lessons
 * once a package opens any; certificates and classes only for packages that
 * include them (the page decides, and the strip's queries run only then).
 */
export function StatStrip({
  totals,
  showCertificates,
  showClasses,
}: {
  totals: LearningTotals
  showCertificates: boolean
  showClasses: boolean
}) {
  return (
    <ul aria-label="Your learning at a glance" className={STRIP}>
      <StatChip icon={InProgressGlyph} value={totals.inProgress} label="In progress" />
      {totals.completed > 0 && <StatChip icon={CompletedGlyph} value={totals.completed} label="Completed" />}
      {totals.lessonsOpen > 0 && (
        <StatChip
          icon={LessonsGlyph}
          value={
            <>
              {totals.lessonsDone}
              <span className="font-normal text-muted-foreground"> / {totals.lessonsOpen}</span>
            </>
          }
          label="Lessons done"
        />
      )}
      {showCertificates && <CertificatesStat />}
      {showClasses && <ClassesStat />}
    </ul>
  )
}

function CertificatesStat() {
  const { data: certificates = [], isLoading } = useMyCertificates()
  return (
    <StatChip
      icon={CertificateGlyph}
      value={isLoading ? <Skel className="my-1 h-3.5 w-6" /> : certificates.length}
      label={certificates.length === 1 ? "Certificate" : "Certificates"}
    />
  )
}

/** `getUpcomingClasses` returns at most 10, so ten reads "10+". */
function ClassesStat() {
  const { data: classes = [], isLoading } = useUpcomingClasses()
  return (
    <StatChip
      icon={ClassesGlyph}
      value={isLoading ? <Skel className="my-1 h-3.5 w-6" /> : classes.length >= 10 ? "10+" : classes.length}
      label={classes.length === 1 ? "Upcoming class" : "Upcoming classes"}
    />
  )
}

export function StatStripSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your progress" className={STRIP}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex min-h-14 items-center gap-3 rounded-full border border-border bg-card py-2 pl-2 pr-5 dark:border-transparent @2xl:flex-1 @2xl:basis-44"
        >
          <Skel className="h-7 w-7 shrink-0 rounded-full" />
          <span className="flex flex-col gap-1.5">
            <Skel className="h-3.5 w-8" />
            <Skel className="h-2.5 w-16" />
          </span>
        </div>
      ))}
    </div>
  )
}

export type QuickAction = { label: string; href: string; icon: Glyph }

/** The rail's verbs, each only where the student's rows give it something behind it. */
export function homeQuickActions({
  hasAssessments,
  showCertificates,
  showClasses,
  canMessage,
  hasMentor,
}: {
  hasAssessments: boolean
  showCertificates: boolean
  showClasses: boolean
  canMessage: boolean
  hasMentor: boolean
}): QuickAction[] {
  const actions: QuickAction[] = [{ label: "Browse programs", href: "/dashboard/courses", icon: BrowseGlyph }]
  if (hasAssessments) actions.push({ label: "Assignments", href: "/dashboard/assignments", icon: AssignmentsGlyph })
  if (showCertificates) actions.push({ label: "Certificates", href: "/dashboard/certificates", icon: CertificateGlyph })
  if (canMessage) actions.push({ label: "Messages", href: "/dashboard/messages", icon: MessagesGlyph })
  if (showClasses) actions.push({ label: "Meetings", href: "/dashboard/meetings", icon: MeetingsGlyph })
  if (hasMentor) actions.push({ label: "Mentorship", href: "/dashboard/mentorship", icon: MentorshipGlyph })
  return actions
}

/** One row that scrolls sideways on a phone (bleeding to the screen edge) and wraps once there is room. */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <nav
      aria-label="Quick actions"
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0 @3xl:flex-wrap @3xl:overflow-visible"
    >
      {actions.map((action) => (
        <ActionPill key={action.href} icon={action.icon} label={action.label} href={action.href} />
      ))}
    </nav>
  )
}
