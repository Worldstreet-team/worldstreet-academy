import Link from "next/link"
import Image from "next/image"
import {
  AwardIcon,
  CalendarClockIcon,
  ChevronRightIcon,
  HandshakeIcon,
  RadioIcon,
  StarIcon,
} from "lucide-react"
import type { ProgramDetail } from "@/lib/actions/student"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { levelTextStyle } from "@/components/shared/level-badge"
import { SchoolIcon } from "@/components/shared/school-icon"
import { AvailabilityCountdown } from "@/components/shared/availability-countdown"
import { CourseSchedulingCta } from "@/components/shared/course-scheduling-cta"
import { WishlistButton } from "@/components/marketing/wishlist-button"
import type { ProgramAccess } from "@/components/programs/access"

/**
 * Spec §6 header: school breadcrumb → title → subtitle line
 * (`shortDescription`, gold) → intro (`description`) → a fact rail → the
 * offer card.
 *
 * The fact rail and the offer card are built ONLY from fields this program
 * actually has. A catalogue program with no lessons, no rating and no
 * enrollments yet (most of them, before launch) must not be given invented
 * numbers to look busier — each fact renders only when it is real, and the
 * rail collapses to whatever is left. The one thing every program does have
 * is its package ladder, so that is what the offer card leads with.
 */
export function ProgramHero({
  program,
  access,
  scheduling,
  signedIn,
  fromPrice,
  multiTier,
}: {
  program: ProgramDetail
  access: ProgramAccess
  /** Present only while the course is coming soon. */
  scheduling: { isComingSoon: boolean; isPreEnrolled: boolean } | null
  signedIn: boolean
  /** Cheapest tier the ladder renders, whole USD — the page's one price source. */
  fromPrice: number
  multiTier: boolean
}) {
  const school = program.school ? SCHOOL_BY_SLUG[program.school] : null
  const linkClass = "transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"

  // Packages arrive in ladder order, enabled only — so the first match is the
  // cheapest tier that unlocks a thing, and its name is what a buyer needs.
  const tierWith = (flag: "certificate" | "mentorship" | "liveClasses") =>
    program.packages.find((p) => p.entitlements[flag]) ?? null
  const certificateTier = tierWith("certificate")
  const mentorshipTier = tierWith("mentorship")
  const liveTier = tierWith("liveClasses")

  const unlocks = [
    liveTier && { icon: RadioIcon, label: "Live classes", tier: liveTier.key },
    certificateTier && { icon: AwardIcon, label: "Certificate", tier: certificateTier.key },
    mentorshipTier && { icon: HandshakeIcon, label: "1-on-1 mentorship", tier: mentorshipTier.key },
  ].filter(Boolean) as Array<{ icon: typeof AwardIcon; label: string; tier: "basic" | "standard" | "executive" }>

  // Every entry is a real, stored value; nothing is synthesized to fill the rail.
  const facts = [
    { label: "Level", value: program.level, capitalize: true, style: levelTextStyle(program.level) },
    multiTier ? { label: "Packages", value: String(program.packages.length) } : null,
    program.whatYouWillLearn.length > 0
      ? { label: "Outcomes", value: String(program.whatYouWillLearn.length) }
      : null,
    program.totalLessons > 0 ? { label: "Lessons", value: String(program.totalLessons) } : null,
    program.totalDuration > 0
      ? { label: "Duration", value: `${Math.round(program.totalDuration / 60)}h` }
      : null,
    program.enrolledCount > 0
      ? { label: "Enrolled", value: program.enrolledCount.toLocaleString("en-US") }
      : null,
  ].filter(Boolean) as Array<{
    label: string
    value: string
    capitalize?: boolean
    style?: React.CSSProperties
  }>

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

          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] empty:mt-0">
            {program.ratingCount > 0 && program.rating !== null && (
              <span className="inline-flex items-center gap-1">
                <StarIcon size={13} className="text-ws-rating" fill="currentColor" aria-hidden />
                <span className="font-medium text-ws-primary">{program.rating.toFixed(1)}</span>
                <span className="tabular-nums text-ws-muted">({program.ratingCount})</span>
              </span>
            )}
            {access.kind === "coming_soon" && program.availableAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ws-brand/10 px-2.5 py-1 text-[11px] font-semibold text-ws-gold">
                <CalendarClockIcon size={12} aria-hidden />
                Coming soon · <AvailabilityCountdown availableAt={program.availableAt} variant="compact" />
              </span>
            )}
          </div>

          {/* The fact rail: label over value, tabular so the row stays even. */}
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5 border-t border-ws-hairline pt-6">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[11px] font-medium uppercase tracking-[0.1em] text-ws-subtle">
                  {fact.label}
                </dt>
                <dd
                  style={fact.style}
                  className={`mt-1 font-display text-[22px] font-medium tabular-nums tracking-[-0.01em] text-ws-primary ${
                    fact.capitalize ? "capitalize" : ""
                  }`}
                >
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface">
            {program.thumbnailUrl ? (
              <div className="relative aspect-video bg-ws-sunken">
                <Image
                  src={program.thumbnailUrl}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 24rem"
                  className="object-cover"
                />
              </div>
            ) : (
              // No art on this program: a school-marked panel beats a blank
              // column, and it never pretends to be a photograph.
              <div
                aria-hidden
                className="relative flex aspect-[16/7] items-center justify-center bg-ws-sunken"
                style={{
                  backgroundImage:
                    "radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--ws-brand-primary) 14%, transparent) 0%, transparent 70%)",
                }}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ws-brand/[0.12] text-ws-gold">
                  <SchoolIcon name={school?.icon ?? "graduation-cap"} size={28} />
                </span>
              </div>
            )}

            <div className="p-6">
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[40px] font-light leading-none tabular-nums tracking-[-0.02em] text-ws-primary">
                  {fromPrice === 0 ? "Free" : `$${fromPrice.toLocaleString("en-US")}`}
                </span>
                {multiTier && fromPrice > 0 && (
                  <span className="text-[13px] font-medium text-ws-muted">to start</span>
                )}
              </p>
              {multiTier && (
                <p className="mt-2 text-[13px] text-ws-muted">
                  {program.packages.length} packages, from {PACKAGE_LABEL[program.packages[0].key]} to{" "}
                  {PACKAGE_LABEL[program.packages[program.packages.length - 1].key]}.
                </p>
              )}

              <div className="mt-5">
                {access.kind === "enrolled" ? (
                  <Link
                    href={access.continueHref}
                    className="flex h-12 w-full items-center justify-center rounded-full bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
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
                      className="flex h-12 w-full items-center justify-center rounded-full bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
                    >
                      {multiTier ? "Choose your package" : "Enrol now"}
                    </a>
                    <WishlistButton courseId={program.id} signedIn={signedIn} variant="full" />
                  </div>
                )}
              </div>

              {unlocks.length > 0 && (
                <ul className="mt-6 space-y-3 border-t border-ws-hairline pt-5">
                  {unlocks.map(({ icon: Icon, label, tier }) => (
                    <li key={label} className="flex items-center gap-3 text-[13px]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ws-brand/[0.12] text-ws-gold">
                        <Icon size={14} aria-hidden />
                      </span>
                      <span className="text-ws-primary">{label}</span>
                      <span className="ml-auto text-ws-subtle">
                        {tier === program.packages[0].key ? "Included" : PACKAGE_LABEL[tier]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </header>
  )
}
