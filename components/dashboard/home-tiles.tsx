"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarClockIcon,
  CircleHelpIcon,
  ExternalLinkIcon,
  PlayIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  TrophyIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageInstructorButton } from "@/app/(platform)/dashboard/instructor/[instructorId]/message-instructor-button"
import type { StudentEnrollment } from "@/lib/actions/student"
import { BRAND } from "@/lib/brand"
import { enrollmentHref, formatDateTime, grantsAccess, type InstructorRow } from "@/lib/dashboard-home"
import { useMyCertificates, useUpcomingClasses } from "@/lib/hooks/queries"

/* Spec §12 dashboard tiles. Surface cards separated by fill (no borders), 13px
   corners, a neutral icon badge — gold stays with the page's Continue learning CTA. */

export function DashboardTile({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon
  title: string
  action?: { label: string; href: string }
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg bg-ws-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 font-display text-[15px] font-semibold text-ws-primary">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ws-raised">
            <Icon size={14} className="text-ws-muted" aria-hidden />
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {action && (
          <Link
            href={action.href}
            className="shrink-0 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
          >
            {action.label}
          </Link>
        )}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  )
}

function TileSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-3/4 animate-pulse rounded-xs bg-ws-raised" />
      <div className="h-3 w-1/2 animate-pulse rounded-xs bg-ws-raised" />
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** CURRENT COURSE — the most recently accessed active enrollment. */
export function CurrentCourseTile({
  enrollment,
  isLoading,
}: {
  enrollment: StudentEnrollment | null
  isLoading: boolean
}) {
  return (
    <DashboardTile icon={PlayIcon} title="Current course">
      {isLoading ? (
        <TileSkeleton />
      ) : enrollment ? (
        <Link href={enrollmentHref(enrollment)} className="flex flex-1 flex-col">
          <p className="line-clamp-2 text-[15px] font-semibold text-ws-primary">{enrollment.courseTitle}</p>
          {enrollment.resumeLessonTitle && (
            <p className="mt-1 truncate text-[13px] text-ws-muted">
              <span className="text-ws-subtle">Resume</span> · {enrollment.resumeLessonTitle}
            </p>
          )}
          <div className="mt-auto pt-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-ws-track">
              <div
                className="h-full rounded-full bg-ws-brand"
                style={{ width: `${Math.max(enrollment.progress, 2)}%` }}
              />
            </div>
            <p className="mt-2 text-[13px] tabular-nums text-ws-muted">{enrollment.progress}% complete</p>
          </div>
        </Link>
      ) : (
        <p className="text-[13px] text-ws-muted">Nothing in progress right now.</p>
      )}
    </DashboardTile>
  )
}

/** MY PROGRESS — the former greeting-pane tally, over the lessons each package opens. */
export function ProgressTile({
  enrollments,
  isLoading,
}: {
  enrollments: StudentEnrollment[]
  isLoading: boolean
}) {
  // Only enrollments that still open the player count — a refunded or expired row isn't progress.
  const granted = enrollments.filter(grantsAccess)
  const totalLessons = granted.reduce((s, e) => s + e.openLessons, 0)
  const completedLessons = granted.reduce(
    (s, e) => s + Math.round(((e.progress ?? 0) / 100) * e.openLessons),
    0
  )
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  const inProgress = granted.filter((e) => e.progress > 0 && e.progress < 100).length
  const completedCourses = granted.filter((e) => e.progress === 100).length

  return (
    <DashboardTile icon={TrendingUpIcon} title="My progress">
      {isLoading ? (
        <TileSkeleton />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Overall progress</p>
            <p className="text-[13px] tabular-nums text-ws-muted">
              {totalLessons > 0 ? (
                <>
                  <span className="font-semibold text-ws-primary">{completedLessons}</span>/{totalLessons} lessons
                </>
              ) : (
                "No lessons yet"
              )}
            </p>
          </div>

          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ws-track">
            <div
              className="h-full rounded-full bg-ws-brand"
              style={{ width: `${Math.max(overallPct, totalLessons > 0 ? 2 : 0)}%` }}
            />
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="tabular-nums">
              <span className="font-display text-xl font-semibold text-ws-primary">{overallPct}%</span>{" "}
              <span className="text-[13px] text-ws-muted">complete</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
                <span className="font-semibold tabular-nums text-ws-primary">{inProgress}</span> in progress
              </span>
              <span className="rounded-full bg-ws-chip px-2.5 py-1 text-[11px] font-medium text-ws-muted">
                <span className="font-semibold tabular-nums text-ws-primary">{completedCourses}</span> completed
              </span>
            </div>
          </div>
        </>
      )}
    </DashboardTile>
  )
}

/** UPCOMING CLASSES — rendered only when some package includes live classes. */
export function UpcomingClassesTile() {
  const { data: classes = [], isLoading } = useUpcomingClasses()
  // Read per render to tell a late class from a future one; the minute refetch re-renders, so staleness is bounded.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  return (
    <DashboardTile
      icon={CalendarClockIcon}
      title="Upcoming classes"
      action={classes.length > 0 ? { label: "Meetings", href: "/dashboard/meetings" } : undefined}
    >
      {isLoading ? (
        <TileSkeleton />
      ) : classes.length === 0 ? (
        <p className="text-[13px] text-ws-muted">No classes scheduled — your instructor will post them here.</p>
      ) : (
        <ul className="space-y-3">
          {classes.slice(0, 3).map((c) => (
            <li key={c.id}>
              <Link href={c.joinHref} className="block min-w-0">
                <p className="truncate text-[13px] font-medium text-ws-primary">{c.title}</p>
                <p className="truncate text-[11px] text-ws-muted">
                  {new Date(c.scheduledAt).getTime() <= now ? (
                    "Waiting for your instructor"
                  ) : (
                    <span className="tabular-nums">{formatDateTime(c.scheduledAt)}</span>
                  )}
                  {c.courseTitle ? ` · ${c.courseTitle}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardTile>
  )
}

/** CERTIFICATES — count + latest; rendered only when some package includes a certificate. */
export function CertificatesTile() {
  const { data: certificates = [], isLoading } = useMyCertificates()
  const latest = certificates[0]
  return (
    <DashboardTile icon={TrophyIcon} title="Certificates" action={{ label: "View all", href: "/dashboard/certificates" }}>
      {isLoading ? (
        <TileSkeleton />
      ) : (
        <>
          <p className="font-display text-3xl font-light tabular-nums text-ws-primary">
            {certificates.length}
            <span className="ml-2 font-sans text-[13px] font-normal text-ws-muted">earned</span>
          </p>
          <p className="mt-2 text-[13px] text-ws-muted">
            {latest ? (
              <>
                Latest: <span className="text-ws-primary">{latest.courseTitle}</span> ·{" "}
                <span className="tabular-nums">
                  {new Date(latest.completedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </span>
              </>
            ) : (
              "Finish a program to earn your first certificate."
            )}
          </p>
        </>
      )}
    </DashboardTile>
  )
}

/** INSTRUCTOR / MENTOR — one row per instructor; Message only where the package includes Q&A. */
export function InstructorsTile({ rows }: { rows: InstructorRow[] }) {
  return (
    <DashboardTile icon={UserRoundIcon} title="Instructor / Mentor">
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.instructorId} className="flex flex-wrap items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt={row.name} />}
              <AvatarFallback>{initials(row.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/dashboard/instructor/${row.instructorId}`}
                  className="truncate text-sm font-semibold text-ws-primary hover:underline"
                >
                  {row.name}
                </Link>
                {row.isMentor && (
                  <span className="shrink-0 rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ws-muted">
                    Your mentor
                  </span>
                )}
              </div>
              {row.headline && <p className="truncate text-xs text-ws-muted">{row.headline}</p>}
            </div>
            <div className="ml-auto">
              {row.canMessage ? (
                <MessageInstructorButton
                  instructorId={row.instructorId}
                  label={row.isMentor ? "Message your mentor" : "Message"}
                  ariaLabel={row.isMentor ? `Message your mentor, ${row.name}` : `Message ${row.name}`}
                  variant="outline"
                />
              ) : (
                <p className="max-w-40 text-right text-[11px] leading-snug text-ws-muted">
                  Instructor Q&amp;A isn&apos;t in your package
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </DashboardTile>
  )
}

/** Inlined at build time; unset or blank hides the tile (D6). */
const COMMUNITY_URL = process.env.NEXT_PUBLIC_COMMUNITY_URL?.trim() || null

/** COMMUNITY — an external link, hidden when NEXT_PUBLIC_COMMUNITY_URL is unset. */
export function CommunityTile() {
  if (!COMMUNITY_URL) return null
  return (
    <DashboardTile icon={UsersIcon} title="Community">
      <p className="text-[13px] text-ws-muted">Connect with other {BRAND.wordmark} learners.</p>
      <a
        href={COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13px] font-medium text-ws-primary transition-opacity hover:opacity-80"
      >
        Join the community
        <ExternalLinkIcon size={13} aria-hidden />
      </a>
    </DashboardTile>
  )
}

/** SUPPORT — the help page; "Priority support" only for a package bought with it. */
export function SupportTile({ priority }: { priority: boolean }) {
  return (
    <DashboardTile icon={CircleHelpIcon} title="Support">
      {priority && (
        <span className="mb-2 inline-flex items-center gap-1 self-start rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-semibold text-ws-primary">
          <ShieldCheckIcon size={12} aria-hidden />
          Priority support
        </span>
      )}
      <p className="text-[13px] text-ws-muted">Answers to common questions, and real people when you need them.</p>
      <Link
        href="/dashboard/help"
        className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13px] font-medium text-ws-primary transition-opacity hover:opacity-80"
      >
        Get help
      </Link>
    </DashboardTile>
  )
}
