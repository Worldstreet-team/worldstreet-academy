import Link from "next/link"
import {
  AwardIcon,
  CalendarClockIcon,
  ChevronRightIcon,
  ListVideoIcon,
  MonitorPlayIcon,
  ChartNoAxesColumnIncreasingIcon,
  SquarePlayIcon,
  UsersIcon,
} from "lucide-react"
import type { ProgramDetail } from "@/lib/actions/student"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { facultyHref } from "@/lib/faculty"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SchoolIcon } from "@/components/shared/school-icon"
import { AvailabilityCountdown } from "@/components/shared/availability-countdown"
import type { ProgramAccess } from "@/components/programs/access"
import type { ProgramFacts } from "@/components/programs/purchase-panel"
import { Stars } from "@/components/programs/stars"
import { formatLength, initialsOf, plural } from "@/components/programs/format"

/**
 * The hero band's text column: where the program sits (breadcrumb + school),
 * what it is (title, subtitle), what others made of it (rating, learners),
 * who teaches it, and what it holds.
 *
 * Every fact renders ONLY when it is real. A catalogue program with no
 * lessons, no rating and no enrollments yet (most of them, before launch)
 * must not be given invented numbers to look busier — each line collapses
 * to whatever is left, and a line with nothing in it is not rendered.
 */
export function ProgramHero({
  program,
  access,
  facts,
  certificate,
  signedIn,
}: {
  program: ProgramDetail
  access: ProgramAccess
  facts: ProgramFacts
  /** Some tier of this program carries the certificate. */
  certificate: boolean
  signedIn: boolean
}) {
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  const rated = program.ratingCount > 0 && program.rating !== null
  const profileHref = program.instructorUsername
    ? facultyHref(program.instructorUsername)
    : signedIn
      ? `/dashboard/instructor/${program.instructorId}`
      : null

  const meta = [
    { icon: ChartNoAxesColumnIncreasingIcon, label: program.level, capitalize: true },
    facts.videoSec > 0 ? { icon: MonitorPlayIcon, label: `${formatLength(facts.videoSec)} of video` } : null,
    facts.lessons > 0 ? { icon: ListVideoIcon, label: plural(facts.lessons, "lesson") } : null,
    facts.previews > 0 ? { icon: SquarePlayIcon, label: plural(facts.previews, "free preview") } : null,
    certificate ? { icon: AwardIcon, label: "Certificate" } : null,
  ].filter(Boolean) as Array<{ icon: typeof AwardIcon; label: string; capitalize?: boolean }>

  const crumb = "rounded-sm transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"

  return (
    <div>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] font-medium text-ws-muted">
          <li>
            <Link href={school ? "/schools" : "/programs"} className={crumb}>
              {school ? "All schools" : "All programs"}
            </Link>
          </li>
          {school && (
            <>
              <li aria-hidden className="text-ws-subtle">
                <ChevronRightIcon size={14} />
              </li>
              <li>
                <Link
                  href={`/schools/${school.slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-ws-surface py-1 pl-1 pr-3 text-ws-primary ring-1 ring-ws-hairline transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:ring-transparent"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-ws-raised text-ws-primary">
                    <SchoolIcon name={school.icon} size={13} aria-hidden />
                  </span>
                  {school.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <h1
        className="mt-6 max-w-[20ch] text-balance font-display font-semibold leading-[1.04] tracking-[-0.025em] text-ws-primary"
        style={{ fontSize: "clamp(2.125rem, 4.4vw, 3.5rem)" }}
      >
        {program.title}
      </h1>
      {program.shortDescription && (
        <p className="mt-5 max-w-2xl text-pretty text-[17px] leading-relaxed text-ws-primary/85 sm:text-[19px]">
          {program.shortDescription}
        </p>
      )}

      {(rated || program.enrolledCount > 0 || (access.kind === "coming_soon" && program.availableAt)) && (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-[14px]">
          {rated && program.rating !== null && (
            <a
              href="#reviews"
              className="group inline-flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
            >
              <span className="font-semibold tabular-nums text-ws-primary">{program.rating.toFixed(1)}</span>
              <Stars rating={program.rating} size={15} />
              <span className="tabular-nums text-ws-muted underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary group-hover:decoration-current">
                ({plural(program.ratingCount, "rating")})
              </span>
            </a>
          )}
          {program.enrolledCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-ws-muted">
              <UsersIcon size={15} aria-hidden />
              <span className="tabular-nums">{plural(program.enrolledCount, "learner")}</span>
            </span>
          )}
          {access.kind === "coming_soon" && program.availableAt && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ws-chip px-3 py-1 text-[12.5px] font-semibold text-ws-primary">
              <CalendarClockIcon size={13} aria-hidden />
              Opens in <AvailabilityCountdown availableAt={program.availableAt} variant="compact" />
            </span>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 text-[14px]">
        <Avatar className="size-9 shrink-0">
          {program.instructorAvatarUrl && <AvatarImage src={program.instructorAvatarUrl} alt="" />}
          <AvatarFallback className="bg-ws-raised text-[12px] font-semibold text-ws-primary">
            {initialsOf(program.instructorName)}
          </AvatarFallback>
        </Avatar>
        <p className="min-w-0 text-ws-muted">
          Taught by{" "}
          {profileHref ? (
            <Link
              href={profileHref}
              className="rounded-sm font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
            >
              {program.instructorName}
            </Link>
          ) : (
            <span className="font-semibold text-ws-primary">{program.instructorName}</span>
          )}
          {program.instructorHeadline && (
            <span className="hidden sm:inline"> · {program.instructorHeadline}</span>
          )}
        </p>
      </div>

      <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3 border-t border-ws-hairline pt-6 text-[14px] text-ws-muted">
        {meta.map(({ icon: Icon, label, capitalize }) => (
          <li key={label} className="inline-flex items-center gap-2">
            <Icon size={16} className="shrink-0 text-ws-subtle" aria-hidden />
            <span className={capitalize ? "capitalize text-ws-primary" : "tabular-nums text-ws-primary"}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
