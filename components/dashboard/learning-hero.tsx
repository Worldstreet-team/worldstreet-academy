"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayIcon } from "@hugeicons/core-free-icons"
import { AvailabilityCountdown } from "@/components/shared/availability-countdown"
import { PackageChip, ProgramCover, ProgressTrack } from "@/components/platform/program-bits"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Balance, CardShell, Eyebrow, Skel, illustrations } from "@/components/ui/system"
import type { StudentEnrollment } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import {
  enrollmentHref,
  formatDateTime,
  homeSummary,
  initials,
  lessonsCompleted,
  nextClass,
  type HomeHero,
} from "@/lib/dashboard-home"
import { useUpcomingClasses } from "@/lib/hooks/queries"
import { SCHOOLS } from "@/lib/schools"
import { cn } from "@/lib/utils"

/*
 * The top of the student home: the greeting row and the learning hero — the
 * Academy's analogue of the hub's balance hero (design-system 05, wallet-hero
 * pattern). The hero's figure is the program's progress, set as the house
 * Balance: Poppins Light, large, tabular.
 */

function greetingFor(hour: number): string {
  if (hour < 5) return "Up late"
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

/**
 * Date eyebrow, salutation, one line of context. The dashboard is the one
 * screen with a salutation (design-system 04 → PageHeader).
 * suppressHydrationWarning: the server's clock and timezone can straddle an
 * hour or a date against the browser's.
 */
export function HomeGreeting({
  firstName,
  welcome,
  now,
  summary,
}: {
  firstName: string
  /** Arrived from checkout (`?welcome=1`). */
  welcome: boolean
  now: number
  summary: React.ReactNode
}) {
  const date = new Date(now)
  return (
    <header className="flex flex-col gap-1">
      <p
        suppressHydrationWarning
        className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>
      <h1
        suppressHydrationWarning
        className="font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[28px]"
      >
        {welcome
          ? `Welcome to ${BRAND.name}`
          : `${greetingFor(date.getHours())}${firstName ? `, ${firstName}` : ""}`}
      </h1>
      <div className="min-h-5 text-[14px] text-muted-foreground">{summary}</div>
    </header>
  )
}

type SummaryProps = {
  enrollments: StudentEnrollment[]
  toDo: number
  now: number
  welcome: boolean
  loading: boolean
  /** The student's packages include live classes — only then is the classes query run. */
  withClasses: boolean
}

/** The greeting's context line. Falls back to a plain invitation when there is nothing true to count. */
export function HomeSummary(props: SummaryProps) {
  if (props.loading) return <Skel className="mt-1 h-4 w-64 max-w-full" />
  return props.withClasses ? <SummaryWithClasses {...props} /> : <SummaryLine {...props} nextClassAt={null} />
}

function SummaryWithClasses(props: SummaryProps) {
  const { data: classes = [] } = useUpcomingClasses()
  return <SummaryLine {...props} nextClassAt={nextClass(classes, props.now)?.scheduledAt ?? null} />
}

function SummaryLine({ enrollments, toDo, now, welcome, nextClassAt }: SummaryProps & { nextClassAt: string | null }) {
  if (welcome) return <p>Your learning journey starts now.</p>
  const line = homeSummary({ enrollments, nextClassAt, toDo, now })
  return (
    <p className="tabular-nums">
      {line || (enrollments.length > 0 ? "Pick up where you left off." : "Pick a program to get started.")}
    </p>
  )
}

/* ── The hero ─────────────────────────────────────────────────────────── */

/** Photo right from ~672px of card width, stacked above the copy below it. */
function HeroFrame({ cover, children }: { cover: React.ReactNode; children: React.ReactNode }) {
  return (
    <CardShell className="@container">
      <div className="grid h-full @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-6 @2xl:p-8">{children}</div>
        <div className="order-first min-w-0 @2xl:order-none @2xl:p-2 @2xl:pl-0">{cover}</div>
      </div>
    </CardShell>
  )
}

const COVER_CLASS =
  "aspect-[2/1] w-full @lg:aspect-[5/2] @2xl:aspect-auto @2xl:h-full @2xl:min-h-72 @2xl:rounded-[12px]"
const COVER_SIZES = "(min-width: 1280px) 600px, (min-width: 768px) 60vw, 100vw"

function HeroTitle({ enrollment: e, eyebrow }: { enrollment: StudentEnrollment; eyebrow: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        {/* A badge requires the package still to exist on the course (`explicitPackage`). */}
        {e.explicitPackage && e.packageName && <PackageChip name={e.packageName} />}
      </div>
      <h2
        title={e.courseTitle}
        className="line-clamp-2 font-display text-[22px] font-semibold leading-[1.2] tracking-[-0.015em] @lg:text-[26px]"
      >
        {e.courseTitle}
      </h2>
      <span className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
        <Avatar size="sm">
          {e.instructorAvatarUrl && <AvatarImage src={e.instructorAvatarUrl} alt="" />}
          <AvatarFallback className="text-[10px]">{initials(e.instructorName)}</AvatarFallback>
        </Avatar>
        <span className="truncate">{e.instructorName}</span>
      </span>
    </div>
  )
}

type HeroLink = { label: string; href: string; icon?: boolean }

/** One gold CTA — the page's only one — and an optional quiet partner. */
function HeroActions({
  primary,
  secondary,
  className,
}: {
  primary: HeroLink
  secondary?: HeroLink | null
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        render={<Link href={primary.href} />}
        className="h-11 gap-2 rounded-full px-5 text-[14px] font-semibold"
      >
        {primary.icon && <HugeiconsIcon icon={PlayIcon} className="size-4" aria-hidden />}
        {primary.label}
      </Button>
      {secondary && (
        <Button
          variant="ghost"
          render={<Link href={secondary.href} />}
          className="h-11 rounded-full px-4 text-[14px] font-medium text-muted-foreground hover:text-foreground"
        >
          {secondary.label}
        </Button>
      )}
    </div>
  )
}

function ContinueHero({ enrollment: e }: { enrollment: StudentEnrollment }) {
  const coursePage = `/dashboard/courses/${e.courseId}`
  const progress = Math.round(e.progress)
  const hasLessons = e.openLessons > 0
  const finished = progress >= 100

  // A program with no published lessons has no player to open yet.
  const primary: HeroLink = !hasLessons
    ? { label: "View program", href: coursePage }
    : {
        label: finished ? "Review lessons" : progress === 0 ? "Start first lesson" : "Resume lesson",
        href: enrollmentHref(e),
        icon: true,
      }
  const secondary: HeroLink | null = !hasLessons
    ? null
    : finished && e.entitlements.certificate
      ? { label: "View certificate", href: `${coursePage}/certificate` }
      : { label: "View program", href: coursePage }

  return (
    <HeroFrame cover={<ProgramCover src={e.courseThumbnail} sizes={COVER_SIZES} mark="lg" className={COVER_CLASS} />}>
      <HeroTitle
        enrollment={e}
        eyebrow={finished ? "Program complete" : progress === 0 ? "Up next" : "Continue learning"}
      />

      <div className="mt-auto flex flex-col gap-6">
        {hasLessons ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-start" aria-label={`${progress}% complete`}>
                <Balance value={String(progress)} className="text-[3.25rem] @2xl:text-[4.25rem]" />
                <span aria-hidden className="mt-1.5 font-display text-[1.5rem] font-light leading-none text-muted-foreground @2xl:mt-2.5 @2xl:text-[1.875rem]">
                  %
                </span>
              </div>
              <div className="flex flex-col items-end pb-1.5 text-right leading-tight">
                <span className="text-[15px] font-semibold tabular-nums">
                  {lessonsCompleted(e)} of {e.openLessons}
                </span>
                <span className="text-[13px] text-muted-foreground">lessons done</span>
              </div>
            </div>
            <ProgressTrack value={progress} label={`${e.courseTitle} progress`} />
            {e.resumeLessonTitle && !finished && (
              <p className="flex min-w-0 items-baseline gap-2 text-[13px]">
                <span className="shrink-0 text-muted-foreground">Next lesson</span>
                <span className="truncate font-medium" title={e.resumeLessonTitle}>
                  {e.resumeLessonTitle}
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-[14px] text-muted-foreground">
            Lessons for this program haven&apos;t been published yet.
          </p>
        )}
        <HeroActions primary={primary} secondary={secondary} />
      </div>
    </HeroFrame>
  )
}

function ReservedHero({ enrollment: e }: { enrollment: StudentEnrollment }) {
  return (
    <HeroFrame cover={<ProgramCover src={e.courseThumbnail} sizes={COVER_SIZES} mark="lg" className={COVER_CLASS} />}>
      <HeroTitle enrollment={e} eyebrow="Seat reserved" />
      <div className="mt-auto flex flex-col gap-6">
        {e.courseAvailableAt && (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-muted-foreground">
              Opens <span className="tabular-nums">{formatDateTime(e.courseAvailableAt)}</span>
            </span>
            <AvailabilityCountdown
              availableAt={e.courseAvailableAt}
              variant="compact"
              className="min-h-[1.05em] font-display text-[2.5rem] font-light leading-[1.05] tracking-[-0.02em] tabular-nums @2xl:text-[3.25rem]"
            />
          </div>
        )}
        <HeroActions primary={{ label: "View program", href: enrollmentHref(e) }} />
      </div>
    </HeroFrame>
  )
}

/** Nothing opens the player: the owl, one invitation, one gold CTA. */
function StartHero({ returning }: { returning: boolean }) {
  return (
    <CardShell className="@container">
      <div className="flex flex-col items-center gap-4 px-5 py-7 text-center @xl:flex-row @xl:gap-8 @xl:p-8 @xl:text-left">
        <Image
          src={illustrations.welcome}
          alt=""
          width={176}
          height={176}
          className="h-36 w-36 shrink-0 object-contain @xl:h-44 @xl:w-44"
        />
        <div className="flex min-w-0 flex-col items-center gap-3 @xl:items-start">
          <Eyebrow>{returning ? "Keep learning" : "Start here"}</Eyebrow>
          <h2 className="font-display text-[24px] font-semibold leading-[1.2] tracking-[-0.015em] @xl:text-[28px]">
            {returning ? "Find your next program" : "Choose your first program"}
          </h2>
          <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
            {returning
              ? "None of your programs open lessons right now. Pick a new one to keep going."
              : `Expert-led programs across ${SCHOOLS.length} schools. Start one and your lessons, classes and certificates gather here.`}
          </p>
          <HeroActions primary={{ label: "Browse programs", href: "/dashboard/courses" }} className="mt-1" />
        </div>
      </div>
    </CardShell>
  )
}

export function LearningHero({ hero, hasEnrollments }: { hero: HomeHero | null; hasEnrollments: boolean }) {
  if (!hero) return <StartHero returning={hasEnrollments} />
  return hero.mode === "reserved" ? (
    <ReservedHero enrollment={hero.enrollment} />
  ) : (
    <ContinueHero enrollment={hero.enrollment} />
  )
}

/** The hero's shape while enrollments load, so nothing re-lays-out when they land. */
export function LearningHeroSkeleton() {
  return (
    <CardShell className="@container" role="status" aria-busy="true" aria-label="Loading your programs">
      <div className="grid h-full @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-6 @2xl:p-8">
          <div className="flex flex-col gap-3">
            <Skel className="h-3 w-32" />
            <Skel className="h-7 w-4/5" />
            <Skel className="h-7 w-3/5" />
            <Skel className="h-5 w-36" />
          </div>
          <div className="mt-auto flex flex-col gap-3">
            <Skel className="h-14 w-28" />
            <Skel className="h-1 w-full rounded-full" />
            <Skel className="h-3 w-48" />
          </div>
          <Skel className="h-11 w-40 rounded-full" />
        </div>
        <div className="order-first min-w-0 @2xl:order-none @2xl:p-2 @2xl:pl-0">
          <Skel className={cn(COVER_CLASS, "rounded-none")} />
        </div>
      </div>
    </CardShell>
  )
}
