"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  Certificate01Icon,
  CustomerSupportIcon,
  HelpCircleIcon,
  LinkSquare02Icon,
  SecurityCheckIcon,
  Tick02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { MessageInstructorButton } from "@/app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button"
import { Chevron, TILE_FOOT_LINK, TILE_ROW, TILE_ROWS, glyph } from "@/components/dashboard/tile-bits"
import { ProgramCover, ProgressTrack, StatusChip } from "@/components/platform/program-bits"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  CardHeader,
  CardShell,
  EmptyState,
  ListRow,
  Segmented,
  SkeletonRows,
  type SegmentedOption,
} from "@/components/ui/system"
import type { StudentEnrollment } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import {
  enrollmentStatusLabel,
  formatClassWhen,
  formatShortDate,
  grantsAccess,
  holdsSeat,
  initials,
  isComingSoon,
  learningStep,
  nextStepHref,
  programsForTab,
  splitClasses,
  type InstructorRow,
  type ProgramTab,
} from "@/lib/dashboard-home"
import { useMyCertificates, useUpcomingClasses } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

/*
 * The student home's tiles (spec §12), on the v2 card grammar: CardShell
 * surfaces named inside by CardHeader (no decorative icon), rows separated by
 * hairlines. Tiles a student's packages can't back are never rendered — the
 * page decides, and home-bento lays out whatever remains.
 */

const ProgramsGlyph = glyph(BookOpen01Icon)
const CertificateGlyph = glyph(Certificate01Icon)
const HelpGlyph = glyph(HelpCircleIcon)
const SupportGlyph = glyph(CustomerSupportIcon)
const CommunityGlyph = glyph(UserGroupIcon)

/* ── My programs ──────────────────────────────────────────────────────── */

const PROGRAM_TABS: readonly SegmentedOption<ProgramTab>[] = [
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
]

const PROGRAM_ROWS = 5

/** Every enrollment, one row each: cover, title, instructor · package, and where it stands. */
export function MyProgramsTile({ enrollments, now }: { enrollments: StudentEnrollment[]; now: number }) {
  // Opens on "In progress" when there is something there; otherwise "All",
  // so a student with only finished or reserved programs isn't met with nothing.
  const [picked, setPicked] = React.useState<ProgramTab | null>(null)
  const inProgress = programsForTab(enrollments, "in_progress", now)
  const tab = picked ?? (inProgress.length > 0 ? "in_progress" : "all")
  const rows = tab === "in_progress" ? inProgress : programsForTab(enrollments, tab, now)
  // "Enrolled" counts seats held — access-granting or reserved (`holdsSeat`);
  // refunded, expired, suspended and cancelled rows are listed under All but aren't enrollments.
  const enrolled = enrollments.filter(holdsSeat).length

  return (
    <CardShell className="@container">
      <CardHeader
        className="flex-wrap"
        title="My programs"
        subtitle={`${enrolled} enrolled`}
        right={<Segmented size="sm" options={PROGRAM_TABS} value={tab} onChange={setPicked} />}
      />
      {rows.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={ProgramsGlyph}
          title={tab === "completed" ? "Nothing completed yet" : "Nothing in progress"}
          description={
            tab === "completed"
              ? "Programs you finish are kept here."
              : "Programs you're working through show here."
          }
          ctas={[{ label: "Show all programs", onClick: () => setPicked("all") }]}
        />
      ) : (
        <div className={TILE_ROWS}>
          {rows.slice(0, PROGRAM_ROWS).map((enrollment) => (
            <ProgramRow key={enrollment.id} enrollment={enrollment} now={now} />
          ))}
        </div>
      )}
      {/* Pinned to the foot, so a card stretched to its partner's height ends on
          purpose. My programs opens on All, so the count is every row it lists. */}
      <Link href="/dashboard/my-courses" className={TILE_FOOT_LINK}>
        {enrollments.length > PROGRAM_ROWS ? `See all ${enrollments.length}` : "See all programs"}
        <Chevron />
      </Link>
    </CardShell>
  )
}

function ProgramRow({ enrollment: e, now }: { enrollment: StudentEnrollment; now: number }) {
  const meta = [e.instructorName, e.explicitPackage ? e.packageName : null].filter(Boolean).join(" · ")
  return (
    <Link href={nextStepHref(e)} className={TILE_ROW}>
      <ProgramCover src={e.courseThumbnail} sizes="64px" mark="sm" className="h-11 w-16 shrink-0 rounded-[10px]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium" title={e.courseTitle}>
          {e.courseTitle}
        </span>
        <span className="truncate text-[12.5px] text-muted-foreground" title={meta}>
          {meta}
        </span>
      </span>
      <ProgramRowState enrollment={e} now={now} />
    </Link>
  )
}

/** The row's right edge: a state chip where the program doesn't open or has a final step, otherwise the figure over its track. */
function ProgramRowState({ enrollment: e, now }: { enrollment: StudentEnrollment; now: number }) {
  const status = enrollmentStatusLabel(e, now)
  if (status) return <StatusChip>{status}</StatusChip>
  if (isComingSoon(e, now) && e.courseAvailableAt) {
    return <StatusChip>Opens {formatShortDate(e.courseAvailableAt, now)}</StatusChip>
  }
  if (!grantsAccess(e)) return null
  const step = learningStep(e)
  if (step === "complete") {
    return (
      <StatusChip tone="success" icon={Tick02Icon}>
        Completed
      </StatusChip>
    )
  }
  if (step === "exam") return <StatusChip>Exam next</StatusChip>
  if (step === "finish") return <StatusChip>Ready to finish</StatusChip>
  if (step === "no_lessons") return <span className="shrink-0 text-[12px] text-muted-foreground">No lessons yet</span>
  const progress = Math.round(e.progress)
  return (
    <span className="flex w-16 shrink-0 flex-col items-end gap-1.5 @md:w-28">
      <span className="text-[13px] font-semibold tabular-nums">{progress}%</span>
      <ProgressTrack value={progress} label={`${e.courseTitle} progress`} />
    </span>
  )
}

/* ── Upcoming classes ─────────────────────────────────────────────────── */

const CLASS_ROWS = 4

/** Rendered only when some package includes live classes. */
export function UpcomingClassesTile({ now }: { now: number }) {
  const { data: classes = [], isLoading } = useUpcomingClasses()
  // The same split the stat strip counts: waiting classes (host not in yet) lead, then those ahead.
  const { waiting, ahead } = splitClasses(classes, now)
  const rows = [...waiting, ...ahead].slice(0, CLASS_ROWS)
  return (
    <CardShell>
      <CardHeader
        title="Upcoming classes"
        subtitle="Live sessions for your programs"
        link={classes.length > 0 ? { label: "Meetings", href: "/dashboard/meetings" } : undefined}
      />
      {isLoading ? (
        <SkeletonRows rows={3} label="Loading classes" />
      ) : rows.length === 0 ? (
        <EmptyState
          className="py-6"
          illustration="noNotifications"
          title="No classes scheduled"
          description="When your instructor schedules a live class, it shows up here."
        />
      ) : (
        <div className={TILE_ROWS}>
          {rows.map((c) => {
            const at = new Date(c.scheduledAt)
            const isWaiting = waiting.includes(c)
            return (
              <Link key={c.id} href={c.joinHref} className={TILE_ROW}>
                {/* Date block: the day is what the eye looks for in a schedule. */}
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[10px] bg-foreground/[0.05] leading-none"
                >
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {at.toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="mt-1 font-display text-[17px] font-semibold tabular-nums">{at.getDate()}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-medium" title={c.title}>
                    {c.title}
                  </span>
                  <span className="truncate text-[12.5px] text-muted-foreground" title={c.courseTitle || undefined}>
                    {isWaiting ? (
                      "Waiting for your instructor"
                    ) : (
                      <span className="tabular-nums">{formatClassWhen(c.scheduledAt, now)}</span>
                    )}
                    {c.courseTitle ? ` · ${c.courseTitle}` : ""}
                  </span>
                </span>
                <Chevron />
              </Link>
            )
          })}
        </div>
      )}
    </CardShell>
  )
}

/* ── Certificates ─────────────────────────────────────────────────────── */

/** Rendered only when some package includes a certificate. */
export function CertificatesTile({ now }: { now: number }) {
  const { data: certificates = [], isLoading } = useMyCertificates()
  return (
    <CardShell>
      <CardHeader
        title="Certificates"
        subtitle={isLoading ? "Your achievements" : `${certificates.length} earned`}
        link={certificates.length > 0 ? { label: "View all", href: "/dashboard/certificates" } : undefined}
      />
      {isLoading ? (
        <SkeletonRows rows={2} label="Loading certificates" />
      ) : certificates.length === 0 ? (
        <EmptyState
          className="py-6"
          illustration="welcome"
          title="No certificates yet"
          description="Finish a program to earn your first certificate."
        />
      ) : (
        <div className={TILE_ROWS}>
          {/* The kit ListRow's shape, written out so a truncated title keeps its full text on hover. */}
          {certificates.slice(0, 3).map((cert) => (
            <Link key={cert.id} href={`/dashboard/courses/${cert.courseId}/certificate`} className={TILE_ROW}>
              <RowChip icon={CertificateGlyph} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-medium" title={cert.courseTitle}>
                  {cert.courseTitle}
                </span>
                <span className="truncate text-[12.5px] text-muted-foreground">
                  Earned {formatShortDate(cert.completedAt, now)}
                </span>
              </span>
              <Chevron />
            </Link>
          ))}
        </div>
      )}
    </CardShell>
  )
}

/* ── Instructors / mentor ─────────────────────────────────────────────── */

/** One row per instructor; Message only where a package includes Q&A. */
export function InstructorsTile({ rows }: { rows: InstructorRow[] }) {
  const anyMessage = rows.some((row) => row.canMessage)
  return (
    <CardShell>
      <CardHeader
        title={rows.length === 1 ? "Your instructor" : "Your instructors"}
        subtitle={anyMessage ? "Ask about your lessons" : "Who teaches your programs"}
      />
      <div className={TILE_ROWS}>
        {rows.map((row) => (
          <div key={row.instructorId} className="flex min-w-0 items-center gap-3 px-4 py-3">
            <Avatar size="lg" className="shrink-0">
              {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt="" />}
              <AvatarFallback>{initials(row.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/dashboard/instructor/${row.instructorId}`}
                  title={row.name}
                  className="truncate text-[14px] font-medium underline-offset-2 outline-none hover:underline focus-visible:underline"
                >
                  {row.name}
                </Link>
                {row.isMentor && <StatusChip>Your mentor</StatusChip>}
              </span>
              {row.headline && (
                <span className="truncate text-[12.5px] text-muted-foreground" title={row.headline}>
                  {row.headline}
                </span>
              )}
              {row.isMentor && (
                <Link
                  href="/dashboard/mentorship"
                  className="w-fit text-[12.5px] font-medium underline-offset-2 outline-none hover:underline focus-visible:underline"
                >
                  Sessions &amp; roadmap
                </Link>
              )}
            </div>
            {row.canMessage ? (
              <MessageInstructorButton
                instructorId={row.instructorId}
                label="Message"
                ariaLabel={row.isMentor ? `Message your mentor, ${row.name}` : `Message ${row.name}`}
                variant="outline"
              />
            ) : (
              <span className="max-w-24 shrink-0 text-right text-[11.5px] leading-snug text-muted-foreground">
                Q&amp;A isn&apos;t in your package
              </span>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  )
}

/* ── Help & community ─────────────────────────────────────────────────── */

/** Inlined at build time; unset or blank hides the community row (D6). */
const COMMUNITY_URL = process.env.NEXT_PUBLIC_COMMUNITY_URL?.trim() || null

/**
 * Always present, so the grid always has a closing tile. "Priority support"
 * only for a package bought with it. At full page width its rows sit side by
 * side instead of stretching one row across the screen.
 */
export function SupportTile({ priority }: { priority: boolean }) {
  return (
    <CardShell className="@container">
      <CardHeader
        title={COMMUNITY_URL ? "Help & community" : "Support"}
        subtitle="Answers, and real people when you need them"
        badge={
          priority ? (
            <StatusChip icon={SecurityCheckIcon} className="text-foreground">
              Priority support
            </StatusChip>
          ) : undefined
        }
      />
      <div className="flex flex-col divide-y divide-border/60 @3xl:grid @3xl:auto-cols-fr @3xl:grid-flow-col @3xl:divide-x @3xl:divide-y-0">
        <ListRow
          icon={HelpGlyph}
          title="Help center"
          subtitle={priority ? "Your package includes priority support" : "Answers to common questions"}
          href="/dashboard/help"
          right={<Chevron />}
          className={TILE_ROW}
        />
        <a href={`mailto:${BRAND.supportEmail}`} className={TILE_ROW}>
          <RowChip icon={SupportGlyph} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] font-medium">Email support</span>
            <span className="truncate text-[12.5px] text-muted-foreground" title={BRAND.supportEmail}>
              {BRAND.supportEmail}
            </span>
          </span>
        </a>
        {COMMUNITY_URL && (
          <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className={TILE_ROW}>
            <RowChip icon={CommunityGlyph} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-medium">Community</span>
              <span className="truncate text-[12.5px] text-muted-foreground">
                Connect with other {BRAND.wordmark} learners
              </span>
            </span>
            <HugeiconsIcon icon={LinkSquare02Icon} className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
    </CardShell>
  )
}

/** The kit ListRow's gold chip, for rows ListRow can't render (mailto, new-tab links, titled rows). */
function RowChip({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/[0.12]")}>
      <Icon className="h-[18px] w-[18px] text-primary" />
    </span>
  )
}
