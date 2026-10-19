"use client"
import { CalendarDays, CalendarPlus, Users } from "@/components/icons"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { CardShell, Eyebrow } from "@/components/ui/system"
import { Countdown } from "@/components/shared/countdown"
import { ProgramCover } from "@/components/platform/program-bits"
import type { HeroClass } from "@/lib/actions/teaching-home"
import { HOST_EARLY_START_MS, hostMayStart } from "@/lib/class-schedule"
import type { CohortView } from "@/lib/cohort-rules"
import { browserZone, classWhenLabel, cohortStartLabel, downloadClassIcs, timeLabel } from "@/lib/teaching-home"
import { cn } from "@/lib/utils"

/*
 * "Your next class": the top of the tutor home. Three states — live (a
 * static red dot, back to the room), upcoming (the big countdown, a start
 * button that opens with joinMeeting's early-start window) and nothing
 * scheduled (where to schedule, and the cohort start for a school program).
 * The program's art takes the right half from ~672px of card width; below
 * that it sits above the copy, and only when the course has a thumbnail.
 */

const PILL = "h-11 rounded-full px-5 text-[14px] font-semibold"
const QUIET_PILL = "h-11 rounded-full px-4 text-[14px] font-medium text-muted-foreground hover:text-foreground"
const EARLY_MINUTES = Math.round(HOST_EARLY_START_MS / 60_000)
const SCHEDULE_HREF = "/instructor/meetings"

function HeroFrame({ art, children }: { art: string | null; children: React.ReactNode }) {
  return (
    <CardShell className="@container">
      <div className="grid flex-1 @2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6 @2xl:p-8">{children}</div>
        <div className={cn("relative order-first min-w-0 @2xl:order-none @2xl:min-h-72", !art && "hidden @2xl:block")}>
          <ProgramCover
            src={art}
            mark="lg"
            sizes="(min-width: 1280px) 560px, (min-width: 768px) 50vw, 100vw"
            className="aspect-[2/1] w-full @2xl:absolute @2xl:inset-0 @2xl:aspect-auto @2xl:h-full"
          />
        </div>
      </div>
    </CardShell>
  )
}

function ClassHeading({ title, courseTitle }: { title: string; courseTitle: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="font-display text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[28px]">{title}</h2>
      <p className="truncate text-[14px] text-muted-foreground">{courseTitle}</p>
    </div>
  )
}

function Expected({ count }: { count: number }) {
  return (
    <p className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
      <Users size={16} strokeWidth={2} aria-hidden />
      <span>
        <span className="font-semibold tabular-nums text-foreground">{count.toLocaleString()}</span>{" "}
        {count === 1 ? "student" : "students"} expected
      </span>
    </p>
  )
}

function LiveHero({ hero }: { hero: HeroClass }) {
  return (
    <HeroFrame art={hero.art}>
      {/* Static on purpose: no pulsing loops on this surface. */}
      <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-danger">
        <span aria-hidden className="h-2 w-2 rounded-full bg-ws-danger" />
        You&apos;re live
      </p>
      <ClassHeading title={hero.title} courseTitle={hero.courseTitle} />
      <div className="flex flex-col gap-2">
        {hero.startedAt && (
          <p className="text-[13.5px] text-muted-foreground">
            Started at <span className="tabular-nums text-foreground">{timeLabel(hero.startedAt)}</span>
          </p>
        )}
        <Expected count={hero.studentsExpected} />
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button render={<Link href={hero.joinHref} />} className={PILL}>
          Back to class
        </Button>
      </div>
    </HeroFrame>
  )
}

function UpcomingHero({ hero, now }: { hero: HeroClass; now: number }) {
  const open = hostMayStart(hero.start, now)
  const zone = browserZone(new Date(hero.start))
  return (
    <HeroFrame art={hero.art}>
      <Eyebrow>Next live class</Eyebrow>
      <ClassHeading title={hero.title} courseTitle={hero.courseTitle} />
      <p className="flex items-start gap-2 text-[13.5px] text-muted-foreground">
        <CalendarDays size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          <span className="tabular-nums text-foreground">{classWhenLabel(hero.start)}</span>
          {" · "}
          {zone.short ? `${zone.short} (${zone.name})` : zone.name}
        </span>
      </p>
      <Countdown
        target={hero.start}
        variant="blocks"
        label="Time until the class starts"
        blockClassName="min-w-[3.75rem] sm:min-w-16"
        endedLabel={
          <span className="text-[14px] font-medium text-foreground">It&apos;s time. Your students are waiting.</span>
        }
      />
      <Expected count={hero.studentsExpected} />
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {open ? (
          <Button render={<Link href={hero.joinHref} />} className={PILL}>
            Start class
          </Button>
        ) : (
          <Button disabled className={PILL} title={`You can start the class from ${EARLY_MINUTES} minutes before`}>
            Opens {EARLY_MINUTES} min before
          </Button>
        )}
        <Button variant="ghost" render={<Link href={SCHEDULE_HREF} />} className={QUIET_PILL}>
          Reschedule / cancel
        </Button>
        <Button
          variant="ghost"
          className={QUIET_PILL}
          onClick={() =>
            downloadClassIcs({
              id: hero.id,
              title: hero.title,
              courseTitle: hero.courseTitle,
              start: hero.start,
              url: `${window.location.origin}${hero.joinHref}`,
            })
          }
        >
          <CalendarPlus size={16} strokeWidth={2} aria-hidden />
          Add to calendar
        </Button>
      </div>
    </HeroFrame>
  )
}

function EmptyHero({
  now,
  teachesProgram,
  hasCourses,
  nextCohort,
}: {
  now: number
  teachesProgram: boolean
  hasCourses: boolean
  nextCohort: CohortView | null
}) {
  const showCohort = teachesProgram && nextCohort !== null && Date.parse(nextCohort.startsAt) > now
  return (
    <HeroFrame art={null}>
      <Eyebrow>Next live class</Eyebrow>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
          No class scheduled
        </h2>
        <p className="max-w-md text-[14px] text-muted-foreground">
          {hasCourses
            ? "Schedule your next class and every student whose package includes live classes is emailed straight away."
            : "Live classes run on your published courses. Publish one to schedule its first class."}
        </p>
      </div>
      {showCohort && nextCohort && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[9px] bg-ws-chip px-3 py-2 text-[13.5px]">
          <span className="font-medium">{nextCohort.name} begins {cohortStartLabel(nextCohort.startsAt)}</span>
          <Countdown target={nextCohort.startsAt} variant="compact" prefix="in " className="text-muted-foreground" />
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {hasCourses ? (
          <Button render={<Link href={SCHEDULE_HREF} />} className={PILL}>
            Schedule a class
          </Button>
        ) : (
          <Button render={<Link href="/instructor/courses" />} className={PILL}>
            Go to My courses
          </Button>
        )}
      </div>
    </HeroFrame>
  )
}

export function NextClassHero({
  hero,
  now,
  teachesProgram,
  hasCourses,
  nextCohort,
}: {
  hero: HeroClass | null
  now: number
  teachesProgram: boolean
  /** Has a course out of draft — the only kind a class can be scheduled on. */
  hasCourses: boolean
  /** The next cohort that has not begun (D20). */
  nextCohort: CohortView | null
}) {
  if (hero?.live) return <LiveHero hero={hero} />
  if (hero) return <UpcomingHero hero={hero} now={now} />
  return <EmptyHero now={now} teachesProgram={teachesProgram} hasCourses={hasCourses} nextCohort={nextCohort} />
}
