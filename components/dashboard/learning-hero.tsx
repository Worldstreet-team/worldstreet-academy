"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { BookOpen01Icon, LiveStreaming02Icon, PlayIcon } from "@hugeicons/core-free-icons"
import { AvailabilityCountdown } from "@/components/shared/availability-countdown"
import { PackageChip, ProgramCover, ProgressTrack } from "@/components/platform/program-bits"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Balance, CardShell, Eyebrow, Segmented, Skel, illustrations } from "@/components/ui/system"
import { dismissEnrollmentIntent, type MyEnrollmentIntent } from "@/lib/actions/enrollment-intent"
import type { ResumeLesson, StudentEnrollment } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import {
  enrollmentHref,
  formatDateTime,
  heroNudge,
  homeSummary,
  initials,
  learningStep,
  lessonChipText,
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

const HERO_COLUMNS = "grid flex-1 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
const COPY_CLASS = "flex min-w-0 flex-col gap-5 p-5 sm:p-6 @2xl:p-8"
const ART_CLASS = "order-first min-w-0 @2xl:order-none @2xl:min-h-80"
const COVER_CLASS = "aspect-[16/9] w-full @lg:aspect-[2/1] @2xl:absolute @2xl:inset-0 @2xl:aspect-auto @2xl:h-full"
const COVER_SIZES = "(min-width: 1280px) 640px, (min-width: 768px) 60vw, 100vw"

/**
 * The stage: copy on the left and the program's art full-bleed on the right
 * from ~672px of card width; the art stacks above the copy below that. `top`
 * (the program switcher) stays put while the program under it changes:
 * `contentKey` remounts the copy and the art, and `fade` cross-fades them in —
 * set after a switch, never on the first paint. `footer` (the HeroStats cells)
 * closes the card under both columns, so the program and the student's totals
 * read as one card.
 */
function HeroFrame({
  art,
  top,
  footer,
  contentKey,
  fade = false,
  children,
}: {
  art: React.ReactNode
  top?: React.ReactNode
  footer?: React.ReactNode
  contentKey: string
  fade?: boolean
  children: React.ReactNode
}) {
  const enter = fade ? "ws-animate-fade" : undefined
  return (
    <CardShell className="@container">
      <div className={HERO_COLUMNS}>
        <div className={COPY_CLASS}>
          {top}
          <div key={contentKey} className={cn("flex min-w-0 flex-1 flex-col gap-6", enter)}>
            {children}
          </div>
        </div>
        <div key={contentKey} className={cn("relative", ART_CLASS, enter)}>
          {art}
        </div>
      </div>
      {footer}
    </CardShell>
  )
}

const LESSON_ICON: Record<ResumeLesson["type"], IconSvgElement> = {
  video: PlayIcon,
  text: BookOpen01Icon,
  live: LiveStreaming02Icon,
}

/**
 * The program's art as the stage, flush to the card's edges and, in dark mode,
 * melting into the card from the copy's side (from below when stacked). `play` puts the
 * lesson's door on the art — a pointer shortcut to the gold CTA, so it stays
 * out of the tab order — and `lesson` names that lesson in a chip. Without a
 * photograph the cover is only the mark on a wash: fine beside the copy, dead
 * space stacked over it on a phone, so it waits for the wide layout.
 */
function StageArt({
  enrollment: e,
  play = null,
  lesson = null,
}: {
  enrollment: StudentEnrollment
  play?: HeroLink | null
  lesson?: ResumeLesson | null
}) {
  return (
    <div className={cn("relative h-full", !e.courseThumbnail && "hidden @2xl:block")}>
      <ProgramCover src={e.courseThumbnail} sizes={COVER_SIZES} mark="lg" className={COVER_CLASS} />
      {/* Dark only: on paper, white fading into a dark photograph is a grey haze, so light mode keeps the clean edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-linear-to-t from-card to-transparent to-45% dark:block @2xl:bg-linear-to-r @2xl:to-40%"
      />
      {play && (
        <Link
          href={play.href}
          tabIndex={-1}
          aria-hidden
          className="ws-icon-mono absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/20 transition-colors duration-[var(--ws-motion-base)] hover:bg-black/75 @2xl:size-[72px]"
        >
          <HugeiconsIcon icon={PlayIcon} className="size-7 translate-x-px" />
        </Link>
      )}
      {lesson && (
        <span className="ws-icon-mono absolute bottom-3 left-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-semibold text-white tabular-nums @2xl:bottom-4 @2xl:left-auto @2xl:right-4">
          <HugeiconsIcon icon={LESSON_ICON[lesson.type]} className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{lessonChipText(lesson)}</span>
        </span>
      )}
    </div>
  )
}

/** False on the first paint, true two frames later — so a transition plays once, on arrival. */
function useArrived(): boolean {
  const [arrived, setArrived] = React.useState(false)
  React.useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setArrived(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])
  return arrived
}

/** Past this many lessons a segment is too thin to read, so the track is one continuous bar. */
const MAX_SEGMENTS = 40

/**
 * One segment per open lesson, in course order: gold where done, a gold ring
 * on the lesson the CTA opens. The done segments fill left to right once, on
 * arrival — transform only, staggered, and off under reduced motion.
 */
function LessonTrack({ marks, current, label }: { marks: boolean[]; current: number | null; label: string }) {
  const arrived = useArrived()
  const done = marks.filter(Boolean).length
  if (marks.length === 0) return null
  if (marks.length > MAX_SEGMENTS) {
    return <ProgressTrack value={(done / marks.length) * 100} label={label} className="h-1.5" />
  }
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={marks.length}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${marks.length} lessons done`}
      className="flex w-full items-center gap-1"
    >
      {marks.map((isDone, i) => (
        <span
          key={i}
          className={cn(
            "relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/[0.08] dark:bg-surface-sunken",
            i === current && !isDone && "ring-1 ring-primary"
          )}
        >
          {isDone && (
            <span
              className="absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-[var(--ws-motion-slow)] ease-[var(--ws-ease)] motion-reduce:transition-none"
              style={{ transform: arrived ? "none" : "scaleX(0)", transitionDelay: `${Math.min(i * 40, 480)}ms` }}
            />
          )}
        </span>
      ))}
    </div>
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
        primary: {
          label: e.resumeLesson?.number ? `Start lesson ${e.resumeLesson.number}` : "Start first lesson",
          href: enrollmentHref(e),
          icon: true,
        },
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

/** The line under the track at the last two steps: what completes the program. */
function StepNote({ enrollment: e, step }: { enrollment: StudentEnrollment; step: "exam" | "finish" }) {
  const allDone = e.completedOpenLessons >= e.openLessons
  return (
    <p className="text-[13px] text-muted-foreground">
      {allDone ? "Every lesson is done. " : ""}
      {step === "exam"
        ? "Pass the final exam to complete the program."
        : "Press Finish on the last lesson to complete the program."}
    </p>
  )
}

/** The lesson the gold CTA opens — the thing the hero is selling: its section in the eyebrow, its title large. */
function NextLesson({ lesson, step }: { lesson: ResumeLesson; step: "start" | "resume" }) {
  const lead = step === "start" ? "First lesson" : "Pick up at"
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Eyebrow className="block truncate">{lesson.sectionTitle ? `${lead} · ${lesson.sectionTitle}` : lead}</Eyebrow>
      <p
        title={lesson.title}
        className="line-clamp-2 font-display text-[18px] font-semibold leading-snug tracking-[-0.01em]"
      >
        {lesson.title}
      </p>
    </div>
  )
}

/**
 * The per-lesson track and its reading. Before the first lesson is done a
 * large 0% says nothing, so the track reads "Lesson 1 of 3"; from the first
 * completion the house Balance figure carries the percentage.
 */
function LessonProgress({ enrollment: e, step }: { enrollment: StudentEnrollment; step: LearningStep }) {
  const progress = Math.round(e.progress)
  const current = (step === "start" || step === "resume") && e.resumeLesson?.number ? e.resumeLesson.number : null
  const track = (
    <LessonTrack marks={e.lessonTrack} current={current === null ? null : current - 1} label={`${e.courseTitle} progress`} />
  )

  if (e.completedOpenLessons === 0) {
    return (
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">{track}</div>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums">
          {current ? `Lesson ${current} of ${e.openLessons}` : `${e.openLessons} ${e.openLessons === 1 ? "lesson" : "lessons"}`}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-start">
          <span className="sr-only">{progress}% complete</span>
          <span aria-hidden className="flex items-start">
            <Balance value={String(progress)} className="text-[3.25rem] @2xl:text-[4rem]" />
            <span className="mt-1.5 font-display text-[1.5rem] font-light leading-none text-muted-foreground @2xl:mt-2.5 @2xl:text-[1.75rem]">
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
      {track}
    </div>
  )
}

type HeroProps = { enrollment: StudentEnrollment; footer?: React.ReactNode }

type Switcher = { programs: StudentEnrollment[]; onChange: (id: string) => void }

/** Whole words, short enough to sit in a Segmented option. */
function switcherLabel(title: string): string {
  const max = 26
  if (title.length <= max) return title
  const cut = title.slice(0, max + 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > 12 ? cut.slice(0, space) : cut.slice(0, max)).replace(/[\s,:;–—-]+$/, "")}…`
}

/** The programs in progress, as the one tab system; it scrolls sideways where the options outrun the column. */
function ProgramSwitcher({ programs, value, onChange }: Switcher & { value: string }) {
  return (
    <div
      role="group"
      aria-label="Your programs in progress"
      className="-m-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Segmented
        size="sm"
        options={programs.map((p) => ({ key: p.id, label: switcherLabel(p.courseTitle) }))}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

function ContinueHero({
  enrollment: e,
  footer,
  now,
  switcher,
  fade,
}: HeroProps & { now: number; switcher: Switcher | null; fade: boolean }) {
  const step = learningStep(e)
  const face = continueFace(e, step)
  const playing = step === "start" || step === "resume"
  const lesson = playing ? e.resumeLesson : null
  const nudge = heroNudge(e, now)

  return (
    <HeroFrame
      art={<StageArt enrollment={e} play={face.primary.icon ? face.primary : null} lesson={lesson} />}
      top={switcher && <ProgramSwitcher {...switcher} value={e.id} />}
      footer={footer}
      contentKey={e.id}
      fade={fade}
    >
      <HeroTitle enrollment={e} eyebrow={face.eyebrow} />

      <div className="mt-auto flex flex-col gap-6">
        {e.openLessons > 0 ? (
          <div className="flex flex-col gap-4">
            {lesson && (step === "start" || step === "resume") && <NextLesson lesson={lesson} step={step} />}
            <div className="flex flex-col gap-2.5">
              <LessonProgress enrollment={e} step={step} />
              {step === "exam" || step === "finish" ? (
                <StepNote enrollment={e} step={step} />
              ) : (
                nudge && <p className="text-[13px] text-muted-foreground tabular-nums">{nudge}</p>
              )}
            </div>
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
    <HeroFrame art={<StageArt enrollment={e} />} footer={footer} contentKey={e.id}>
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
    <HeroFrame art={<StageArt enrollment={e} />} footer={footer} contentKey={e.id}>
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

/** How many programs in progress the hero's switcher offers — the most recently opened first. */
const SWITCHER_MAX = 4

/**
 * `footer` is the student's totals (HeroStats); the Start hero has none to
 * show, so it ignores it. `programs` are the programs in progress, recent
 * first: when the hero leads with one of them and there are two or more, the
 * hero offers a switcher between them.
 */
export function LearningHero({
  hero,
  programs = [],
  now,
  hasEnrollments,
  footer,
  intent = null,
}: {
  hero: HomeHero | null
  programs?: StudentEnrollment[]
  now: number
  hasEnrollments: boolean
  footer?: React.ReactNode
  /** The learner's saved-but-unpaid school; shown only while nothing opens the player. */
  intent?: MyEnrollmentIntent | null
}) {
  const [picked, setPicked] = React.useState<string | null>(null)
  if (!hero && intent) return <FinishEnrollingHero intent={intent} />
  if (!hero) return <StartHero returning={hasEnrollments} />
  if (hero.mode === "reserved") return <ReservedHero enrollment={hero.enrollment} footer={footer} />
  if (hero.mode === "seat_ready") return <SeatReadyHero enrollment={hero.enrollment} footer={footer} />

  const offered = programs.slice(0, SWITCHER_MAX)
  const switchable = offered.length > 1 && offered.some((p) => p.id === hero.enrollment.id)
  const shown = (switchable && offered.find((p) => p.id === picked)) || hero.enrollment
  return (
    <ContinueHero
      enrollment={shown}
      footer={footer}
      now={now}
      switcher={switchable ? { programs: offered, onChange: setPicked } : null}
      fade={picked !== null}
    />
  )
}

/** The hero's shape while enrollments load, so nothing re-lays-out when they land. */
export function LearningHeroSkeleton({ footer }: { footer?: React.ReactNode } = {}) {
  return (
    <CardShell className="@container" role="status" aria-busy="true" aria-label="Loading your programs">
      <div className={HERO_COLUMNS}>
        <div className={cn(COPY_CLASS, "gap-6")}>
          <div className="flex flex-col gap-3">
            <Skel className="h-3 w-32" />
            <Skel className="h-7 w-4/5" />
            <Skel className="h-5 w-36" />
          </div>
          <div className="mt-auto flex flex-col gap-3">
            <Skel className="h-3 w-40" />
            <Skel className="h-5 w-3/5" />
            <Skel className="h-1.5 w-full rounded-full" />
            <Skel className="h-3 w-48" />
          </div>
          <Skel className="h-11 w-40 rounded-full" />
        </div>
        <div className={cn("relative", ART_CLASS)}>
          <Skel className={cn(COVER_CLASS, "rounded-none")} />
        </div>
      </div>
      {footer}
    </CardShell>
  )
}
