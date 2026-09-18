"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayIcon } from "@hugeicons/core-free-icons"
import { AvailabilityCountdown } from "@/components/shared/availability-countdown"
import { PackageChip, ProgramCover, ProgressTrack } from "@/components/platform/program-bits"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Balance, CardShell, Eyebrow, Skel, illustrations } from "@/components/ui/system"
import { dismissEnrollmentIntent, type MyEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import type { StudentEnrollment } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import {
  enrollmentHref,
  formatDateTime,
  homeSummary,
  initials,
  learningStep,
  nextClass,
  nextStepHref,
  type HomeHero,
  type LearningStep,
} from "@/lib/dashboard-home"
import { useUpcomingClasses } from "@/lib/hooks/queries"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { useClientNow } from "@/lib/hooks/use-now"
import { schoolCover } from "@/lib/school-art"
import { SCHOOL_BY_SLUG, SCHOOLS } from "@/lib/schools"
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

/** A long date, rendered invisibly so the eyebrow keeps its size until the browser's clock is read. */
const DATE_PLACEHOLDER = "Wednesday, September 30"

/**
 * Date eyebrow, salutation, one line of context. The dashboard is the one
 * screen with a salutation (design-system 04 → PageHeader). The date and the
 * greeting follow the student's own clock and timezone, so they are read in
 * the browser only (`useClientNow`); the server and the hydration pass render
 * same-size invisible text in their place.
 */
export function HomeGreeting({
  firstName,
  welcome,
  summary,
}: {
  firstName: string
  /** Arrived from checkout (`?welcome=1`). */
  welcome: boolean
  summary: React.ReactNode
}) {
  const now = useClientNow()
  const date = now === null ? null : new Date(now)
  const name = firstName ? `, ${firstName}` : ""
  return (
    <header className="flex flex-col gap-1">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {date ? (
          date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
        ) : (
          <span aria-hidden className="invisible">
            {DATE_PLACEHOLDER}
          </span>
        )}
      </p>
      <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
        {welcome ? (
          `Welcome to ${BRAND.name}`
        ) : date ? (
          `${greetingFor(date.getHours())}${name}`
        ) : (
          <span aria-hidden className="invisible">{`Good afternoon${name}`}</span>
        )}
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
  /** Enrollments or assessments still loading — the line waits for every clause it may carry. */
  loading: boolean
  /** The student's packages include live classes — only then is the classes query run. */
  withClasses: boolean
}

function SummarySkeleton() {
  return <Skel className="mt-1 h-4 w-64 max-w-full" />
}

/** The greeting's context line. Falls back to a plain invitation when there is nothing true to count. */
export function HomeSummary(props: SummaryProps) {
  if (props.welcome) return <p>Your learning journey starts now.</p>
  if (props.loading) return <SummarySkeleton />
  return props.withClasses ? <SummaryWithClasses {...props} /> : <SummaryLine {...props} nextClassAt={null} />
}

function SummaryWithClasses(props: SummaryProps) {
  const { data: classes = [], isLoading } = useUpcomingClasses()
  // Held until classes land too, so the line never grows a clause after it appears.
  if (isLoading) return <SummarySkeleton />
  return <SummaryLine {...props} nextClassAt={nextClass(classes, props.now)?.scheduledAt ?? null} />
}

function SummaryLine({ enrollments, toDo, now, nextClassAt }: SummaryProps & { nextClassAt: string | null }) {
  const line = homeSummary({ enrollments, nextClassAt, toDo, now })
  return (
    <p className="tabular-nums">
      {line || (enrollments.length > 0 ? "Pick a new program to keep going." : "Pick a program to get started.")}
    </p>
  )
}

/* ── The hero ─────────────────────────────────────────────────────────── */

/**
 * Photo right from ~672px of card width, stacked above the copy below it.
 * `footer` (the HeroStats cells) closes the card under both columns, so the
 * program and the student's totals read as one card.
 */
function HeroFrame({
  cover,
  footer,
  children,
}: {
  cover: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <CardShell className="@container">
      <div className="grid flex-1 @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-6 @2xl:p-8">{children}</div>
        <div className="order-first min-w-0 @2xl:order-none @2xl:p-2 @2xl:pl-0">{cover}</div>
      </div>
      {footer}
    </CardShell>
  )
}

const COVER_CLASS =
  "aspect-[2/1] w-full @lg:aspect-[5/2] @2xl:aspect-auto @2xl:h-full @2xl:min-h-72 @2xl:rounded-[12px]"
const COVER_SIZES = "(min-width: 1280px) 600px, (min-width: 768px) 60vw, 100vw"

/** Without a photograph the cover is only the mark on a wash: fine beside the copy, dead space stacked over it on a phone, so it waits for the wide layout. */
function HeroCover({ enrollment: e }: { enrollment: StudentEnrollment }) {
  return (
    <ProgramCover
      src={e.courseThumbnail}
      sizes={COVER_SIZES}
      mark="lg"
      className={cn(COVER_CLASS, !e.courseThumbnail && "hidden @2xl:block")}
    />
  )
}

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
        <span className="truncate" title={e.instructorName}>
          {e.instructorName}
        </span>
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

type HeroFace = { eyebrow: string; primary: HeroLink; secondary: HeroLink | null }

/** What the hero says and offers at each `learningStep`; each CTA goes where that step's flow lives. */
function continueFace(e: StudentEnrollment, step: LearningStep): HeroFace {
  const coursePage = `/dashboard/courses/${e.courseId}`
  const viewProgram: HeroLink = { label: "View program", href: coursePage }
  const hasLessons = e.openLessons > 0
  switch (step) {
    case "complete":
      return {
        eyebrow: "Program complete",
        primary: hasLessons ? { label: "Review lessons", href: enrollmentHref(e), icon: true } : viewProgram,
        // The certificate page needs a completed enrollment on a package that certifies.
        secondary: e.entitlements.certificate
          ? { label: "View certificate", href: `${coursePage}/certificate` }
          : hasLessons
            ? viewProgram
            : null,
      }
    case "exam":
      return {
        eyebrow: "Final step: take the exam",
        primary: { label: "Take the exam", href: nextStepHref(e) },
        secondary: { label: "Review lessons", href: enrollmentHref(e) },
      }
    case "finish":
      return {
        eyebrow: "Finish the program",
        primary: { label: "Finish the program", href: nextStepHref(e) },
        secondary: viewProgram,
      }
    case "no_lessons":
      return { eyebrow: "Up next", primary: viewProgram, secondary: null }
    case "start":
      return {
        eyebrow: "Up next",
        primary: { label: "Start first lesson", href: enrollmentHref(e), icon: true },
        secondary: viewProgram,
      }
    case "resume":
      return {
        eyebrow: "Continue learning",
        primary: { label: "Resume lesson", href: enrollmentHref(e), icon: true },
        secondary: viewProgram,
      }
  }
}

/** The line under the progress track: where the player resumes, or what completes the program. */
function StepNote({ enrollment: e, step }: { enrollment: StudentEnrollment; step: LearningStep }) {
  const allDone = e.completedOpenLessons >= e.openLessons
  if (step === "exam" || step === "finish") {
    return (
      <p className="text-[13px] text-muted-foreground">
        {allDone ? "Every lesson is done. " : ""}
        {step === "exam"
          ? "Pass the final exam to complete the program."
          : "Press Finish on the last lesson to complete the program."}
      </p>
    )
  }
  if ((step !== "start" && step !== "resume") || !e.resumeLessonTitle) return null
  return (
    <p className="flex min-w-0 items-baseline gap-2 text-[13px]">
      <span className="shrink-0 text-muted-foreground">{step === "start" ? "Starts with" : "Resume at"}</span>
      <span className="truncate font-medium" title={e.resumeLessonTitle}>
        {e.resumeLessonTitle}
      </span>
    </p>
  )
}

type HeroProps = { enrollment: StudentEnrollment; footer?: React.ReactNode }

function ContinueHero({ enrollment: e, footer }: HeroProps) {
  const step = learningStep(e)
  const face = continueFace(e, step)
  const progress = Math.round(e.progress)

  return (
    <HeroFrame cover={<HeroCover enrollment={e} />} footer={footer}>
      <HeroTitle enrollment={e} eyebrow={face.eyebrow} />

      <div className="mt-auto flex flex-col gap-6">
        {e.openLessons > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-start">
                <span className="sr-only">{progress}% complete</span>
                <span aria-hidden className="flex items-start">
                  <Balance value={String(progress)} className="text-[3.25rem] @2xl:text-[4.25rem]" />
                  <span className="mt-1.5 font-display text-[1.5rem] font-light leading-none text-muted-foreground @2xl:mt-2.5 @2xl:text-[1.875rem]">
                    %
                  </span>
                </span>
              </div>
              <div className="flex flex-col items-end pb-1.5 text-right leading-tight">
                <span className="text-[15px] font-semibold tabular-nums">
                  {e.completedOpenLessons} of {e.openLessons}
                </span>
                <span className="text-[13px] text-muted-foreground">lessons done</span>
              </div>
            </div>
            <ProgressTrack value={progress} label={`${e.courseTitle} progress`} />
            <StepNote enrollment={e} step={step} />
          </div>
        ) : (
          <p className="text-[14px] text-muted-foreground">
            Lessons for this program haven&apos;t been published yet.
          </p>
        )}
        <HeroActions primary={face.primary} secondary={face.secondary} />
      </div>
    </HeroFrame>
  )
}

/**
 * A reservation on a program that is already open. Nothing plays until
 * checkout activates the seat; the program page's "Start course" is that door.
 */
function SeatReadyHero({ enrollment: e, footer }: HeroProps) {
  return (
    <HeroFrame cover={<HeroCover enrollment={e} />} footer={footer}>
      <HeroTitle enrollment={e} eyebrow="Seat ready" />
      <div className="mt-auto flex flex-col gap-6">
        <p className="text-[14px] text-muted-foreground">
          This program is open. Complete your enrollment to start learning.
        </p>
        <HeroActions primary={{ label: "Complete enrollment", href: `/dashboard/courses/${e.courseId}` }} />
      </div>
    </HeroFrame>
  )
}

function ReservedHero({ enrollment: e, footer }: HeroProps) {
  return (
    <HeroFrame cover={<HeroCover enrollment={e} />} footer={footer}>
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
          <HeroActions
            primary={{
              label: returning ? "Browse programs" : "Choose your school",
              href: returning ? "/dashboard/courses" : "/dashboard/start?pick=1",
            }}
            className="mt-1"
          />
        </div>
      </div>
    </CardShell>
  )
}

/** A school is saved and unpaid: its art, the exact order, one gold CTA — and a quiet way to put it down. */
function FinishEnrollingHero({ intent }: { intent: MyEnrollmentIntent }) {
  const queryClient = useQueryClient()
  const school = SCHOOL_BY_SLUG[intent.school]
  const cover = schoolCover(intent.school)
  const price =
    intent.price === null
      ? null
      : intent.price === 0
        ? "Free"
        : `${intent.fromPrice ? "from " : ""}$${intent.price.toLocaleString("en-US")}`

  async function dismiss() {
    await dismissEnrollmentIntent()
    queryClient.invalidateQueries({ queryKey: queryKeys.enrollmentIntent })
  }

  return (
    <CardShell className="@container overflow-hidden">
      <div className="flex flex-col @xl:flex-row">
        {cover && (
          <div className="relative aspect-[16/9] w-full shrink-0 bg-ws-sunken @xl:aspect-auto @xl:w-[42%]">
            <Image src={cover} alt="" fill sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3 p-6 @xl:p-8">
          <Eyebrow>Saved for you</Eyebrow>
          <h2 className="font-display text-[24px] font-semibold leading-[1.2] tracking-[-0.015em] @xl:text-[28px]">
            {intent.courseTitle ?? school.name}
          </h2>
          <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
            {intent.courseTitle
              ? [school.short, intent.packageName, price].filter(Boolean).join(" · ")
              : "Your school is saved. Its programs appear here as they open."}
          </p>
          <HeroActions
            primary={{ label: intent.courseId ? "Finish enrolling" : "View school", href: intent.href }}
            secondary={{ label: "Choose another school", href: "/dashboard/start?pick=1" }}
            className="mt-1"
          />
          <button
            type="button"
            onClick={dismiss}
            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </CardShell>
  )
}

/** `footer` is the student's totals (HeroStats); the Start hero has none to show, so it ignores it. */
export function LearningHero({
  hero,
  hasEnrollments,
  footer,
  intent = null,
}: {
  hero: HomeHero | null
  hasEnrollments: boolean
  footer?: React.ReactNode
  /** The learner's saved-but-unpaid school; shown only while nothing opens the player. */
  intent?: MyEnrollmentIntent | null
}) {
  if (!hero && intent) return <FinishEnrollingHero intent={intent} />
  if (!hero) return <StartHero returning={hasEnrollments} />
  if (hero.mode === "reserved") return <ReservedHero enrollment={hero.enrollment} footer={footer} />
  if (hero.mode === "seat_ready") return <SeatReadyHero enrollment={hero.enrollment} footer={footer} />
  return <ContinueHero enrollment={hero.enrollment} footer={footer} />
}

/** The hero's shape while enrollments load, so nothing re-lays-out when they land. */
export function LearningHeroSkeleton({ footer }: { footer?: React.ReactNode } = {}) {
  return (
    <CardShell className="@container" role="status" aria-busy="true" aria-label="Loading your programs">
      <div className="grid flex-1 @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
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
      {footer}
    </CardShell>
  )
}
