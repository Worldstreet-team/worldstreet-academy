import Link from "next/link"
import Image from "next/image"
import { CalendarClockIcon, ChevronRightIcon, StarIcon } from "lucide-react"
import type { ProgramDetail } from "@/lib/actions/student"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { levelChipStyle } from "@/components/shared/level-badge"
import { AvailabilityCountdown } from "@/components/shared/availability-countdown"
import { CourseSchedulingCta } from "@/components/shared/course-scheduling-cta"
import { WishlistButton } from "@/components/marketing/wishlist-button"
import { programPriceLabel } from "@/components/marketing/program-row"
import type { ProgramAccess } from "@/components/programs/access"

/**
 * Spec §6 header: school breadcrumb → title → subtitle line
 * (`shortDescription`, gold) → intro (`description`) → level · price · rating
 * (only with real reviews) · coming-soon countdown. The right column holds
 * the art and the one CTA for this visitor's state.
 */
export function ProgramHero({
  program,
  access,
  scheduling,
  signedIn,
}: {
  program: ProgramDetail
  access: ProgramAccess
  /** Present only while the course is coming soon or the visitor holds a pre-launch reservation. */
  scheduling: { isComingSoon: boolean; isPreEnrolled: boolean } | null
  signedIn: boolean
}) {
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  const linkClass =
    "transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"

  return (
    <header className="mx-auto max-w-7xl px-6 pt-10 md:pt-16">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ws-muted"
      >
        <Link href="/schools" className={linkClass}>
          All schools
        </Link>
        {school && (
          <>
            <ChevronRightIcon size={14} aria-hidden className="text-ws-subtle" />
            <Link href={`/schools/${school.slug}`} className={linkClass}>
              {school.name}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
        <div className="max-w-3xl">
          <h1
            className="font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            {program.title}
          </h1>
          {program.shortDescription && (
            <p className="mt-4 font-display text-xl font-medium text-ws-gold md:text-2xl">
              {program.shortDescription}
            </p>
          )}
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ws-muted md:text-[17px]">
            {program.description}
          </p>

          <ul className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]" aria-label="Program details">
            <li>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium capitalize"
                style={levelChipStyle(program.level)}
              >
                {program.level}
              </span>
            </li>
            <li className="font-semibold tabular-nums text-ws-primary">{programPriceLabel(program)}</li>
            {program.ratingCount > 0 && program.rating !== null && (
              <li className="inline-flex items-center gap-1">
                <StarIcon size={13} className="text-ws-rating" fill="currentColor" aria-hidden />
                <span className="font-medium text-ws-primary">{program.rating.toFixed(1)}</span>
                <span className="tabular-nums text-ws-muted">({program.ratingCount})</span>
              </li>
            )}
            {program.totalLessons > 0 && (
              <li className="tabular-nums text-ws-muted">
                {program.totalLessons} {program.totalLessons === 1 ? "lesson" : "lessons"}
              </li>
            )}
            {access.kind === "coming_soon" && program.availableAt && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-ws-brand/10 px-2.5 py-1 text-[11px] font-semibold text-ws-gold">
                <CalendarClockIcon size={12} aria-hidden />
                Coming soon · <AvailabilityCountdown availableAt={program.availableAt} variant="compact" />
              </li>
            )}
          </ul>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {program.thumbnailUrl && (
            <div className="relative mb-5 aspect-video overflow-hidden rounded-lg bg-ws-sunken">
              <Image
                src={program.thumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 24rem"
                className="object-cover"
              />
            </div>
          )}
          <div className="rounded-lg border border-ws-hairline bg-ws-surface p-5">
            {access.kind === "enrolled" ? (
              <Link
                href={access.continueHref}
                className="flex h-11 w-full items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
              >
                Continue learning
              </Link>
            ) : scheduling ? (
              <CourseSchedulingCta
                courseId={program.id}
                availableAt={program.availableAt}
                isComingSoon={scheduling.isComingSoon}
                preEnrollEnabled={program.preEnrollEnabled}
                isPreEnrolled={scheduling.isPreEnrolled}
                isPaid={program.pricing === "paid"}
                price={program.price}
                signedIn={signedIn}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <a
                  href="#packages"
                  className="flex h-11 w-full items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
                >
                  {program.packages.length > 1 ? "Choose your package" : "Enrol now"}
                </a>
                <WishlistButton courseId={program.id} signedIn={signedIn} variant="full" />
              </div>
            )}
          </div>
        </aside>
      </div>
    </header>
  )
}
