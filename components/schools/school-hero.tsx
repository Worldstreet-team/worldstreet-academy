import Link from "next/link"
import { ChevronRightIcon, StarIcon } from "lucide-react"
import { SCHOOLS, type School } from "@/lib/schools"
import type { CourseRatingSummary } from "@/lib/actions/reviews"
import { packagePriceLabel } from "@/lib/program-price"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SchoolIcon } from "@/components/shared/school-icon"
import { initialsOf } from "@/components/programs/format"
import { SchoolHeroArt } from "@/components/schools/school-hero-art"
import { CtaLink, GOLD_CTA, type SchoolCta } from "@/components/schools/cta"
import { LEVEL_LABEL, levelsOf, type SchoolProgram } from "@/components/schools/model"

const two = (n: number) => String(n).padStart(2, "0")

/** Rise cascade: each block of the hero steps in 60ms after the last. */
const rise = (step: number) => ({ "--rise-delay": `${step * 60}ms` }) as React.CSSProperties

/**
 * The school's hero. From lg the render is the stage — full bleed, as tall as
 * the viewport under the navbar (capped), the copy on its dark left and a
 * strip of facts along its foot (layout of the render itself:
 * `SchoolHeroArt`). The stage is dark in both themes, so everything on it is
 * white in both. Below lg the render leads edge to edge and the copy follows
 * on the page, in ink.
 *
 * The facts are real or absent: programs, level range, the cheapest price,
 * free lessons, who teaches, learners and the combined rating each render
 * only when there is something true and non-zero to say.
 */
export function SchoolHero({
  school,
  cover,
  programs,
  rating,
  primary,
  secondary,
}: {
  school: School
  cover: string | null
  programs: SchoolProgram[]
  rating: CourseRatingSummary | null
  /** The page's one gold action (see the page: where the journey goes next). */
  primary: SchoolCta
  secondary: SchoolCta | null
}) {
  const onArt = cover !== null
  const lede = school.tagline ?? school.blurb
  const body = school.tagline ? (school.intro ?? school.blurb) : school.intro

  const crumb = cn(
    "rounded-sm transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
    onArt ? "hover:text-ws-primary lg:hover:text-white" : "hover:text-ws-primary"
  )

  return (
    <section
      aria-labelledby="school-title"
      className={cn("relative isolate", onArt && "lg:flex lg:min-h-[min(calc(100svh-4rem),58rem)] lg:flex-col")}
    >
      {cover && <SchoolHeroArt src={cover} />}

      <div
        className={cn(
          "relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-6",
          onArt ? "-mt-6 pb-12 sm:-mt-12 lg:mt-0 lg:pb-0" : "pb-12 pt-10 md:pt-14"
        )}
      >
        <nav aria-label="Breadcrumb" className={cn("rise", onArt && "lg:pt-8")} style={rise(0)}>
          <ol
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-ws-muted",
              onArt && "lg:text-white/60"
            )}
          >
            <li>
              <Link href="/schools" className={crumb}>
                All schools
              </Link>
            </li>
            <li aria-hidden className={cn("text-ws-subtle", onArt && "lg:text-white/35")}>
              <ChevronRightIcon size={14} />
            </li>
            <li aria-current="page" className={cn("text-ws-primary", onArt && "lg:text-white/90")}>
              {school.short}
            </li>
          </ol>
        </nav>

        <div className={cn("mt-6 max-w-[40rem] sm:mt-8", onArt && "lg:my-auto lg:max-w-[min(46rem,48%)] lg:py-10")}>
          <p className="rise flex items-center gap-3" style={rise(1)}>
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full bg-ws-chip text-ws-primary ring-1 ring-ws-hairline",
                onArt && "lg:bg-white/10 lg:text-white lg:ring-white/15"
              )}
            >
              <SchoolIcon name={school.icon} size={18} aria-hidden />
            </span>
            <span className={cn("text-[13px] font-medium text-ws-muted", onArt && "lg:text-white/70")}>
              School <span className="tabular-nums">{two(school.order)}</span> of{" "}
              <span className="tabular-nums">{two(SCHOOLS.length)}</span>
            </span>
          </p>

          <h1
            id="school-title"
            className={cn(
              "rise mt-5 text-balance font-display font-semibold leading-[1.02] tracking-[-0.03em] text-ws-primary sm:mt-6",
              onArt && "lg:text-white"
            )}
            style={{ ...rise(2), fontSize: "clamp(2.375rem, 4.2vw, 4rem)" }}
          >
            {school.name}
          </h1>

          <p
            className={cn(
              "rise mt-4 max-w-[36rem] text-pretty font-display text-[19px] font-medium leading-snug tracking-[-0.01em] text-ws-primary/90 sm:mt-5 sm:text-[21px]",
              onArt && "lg:text-white/90"
            )}
            style={rise(3)}
          >
            {lede}
          </p>
          {body && (
            <p
              className={cn(
                "rise mt-4 max-w-[36rem] text-pretty text-[15px] leading-relaxed text-ws-muted sm:text-[16px]",
                onArt && "lg:text-white/65"
              )}
              style={rise(4)}
            >
              {body}
            </p>
          )}

          <div className="rise mt-7 flex flex-wrap items-center gap-3 sm:mt-8" style={rise(5)}>
            <CtaLink cta={primary} data-school-cta="hero" className={GOLD_CTA}>
              {primary.label}
            </CtaLink>
            {secondary && (
              <CtaLink
                cta={secondary}
                className={cn(
                  "inline-flex h-12 items-center justify-center rounded-full border border-ws-hairline px-6 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 active:translate-y-px",
                  onArt && "lg:border-white/25 lg:text-white lg:hover:bg-white/10"
                )}
              >
                {secondary.label}
              </CtaLink>
            )}
          </div>
        </div>

        <HeroFacts programs={programs} rating={rating} onArt={onArt} />
      </div>
    </section>
  )
}

function HeroFacts({
  programs,
  rating,
  onArt,
}: {
  programs: SchoolProgram[]
  rating: CourseRatingSummary | null
  onArt: boolean
}) {
  if (programs.length === 0) return null

  const levels = levelsOf(programs)
  const prices = programs.map(({ program }) => (program.pricing === "free" ? 0 : (program.price ?? null)))
  const known = prices.filter((p): p is number => p !== null)
  const cheapest = known.length > 0 ? Math.min(...known) : null
  const freeLessons = programs.reduce((sum, p) => sum + p.facts.previews, 0)
  const learners = programs.reduce((sum, p) => sum + p.program.enrolledCount, 0)
  const instructors = [
    ...new Map(
      programs.map(({ program }) => [
        program.instructorId,
        { name: program.instructorName, avatarUrl: program.instructorAvatarUrl },
      ])
    ).values(),
  ]

  const label = cn("text-[12.5px] font-medium text-ws-muted", onArt && "lg:text-white/55")
  const value = cn(
    "mt-1.5 flex min-w-0 items-center gap-2 font-display text-[19px] font-medium leading-tight tracking-[-0.01em] text-ws-primary",
    onArt && "lg:text-white"
  )

  const facts: Array<{ key: string; label: string; value: React.ReactNode }> = [
    { key: "programs", label: "Programs", value: <span className="tabular-nums">{programs.length}</span> },
    {
      key: "levels",
      label: levels.length > 1 ? "Levels" : "Level",
      value:
        levels.length > 1 ? (
          // One run of text, so a narrow cell wraps it instead of overflowing.
          <span className="min-w-0">
            {LEVEL_LABEL[levels[0]]}{" "}
            <span aria-hidden className={cn("text-ws-subtle", onArt && "lg:text-white/40")}>
              →
            </span>
            <span className="sr-only">to</span> {LEVEL_LABEL[levels[levels.length - 1]]}
          </span>
        ) : (
          LEVEL_LABEL[levels[0]]
        ),
    },
    ...(cheapest !== null
      ? [{ key: "price", label: "Starting at", value: <span className="tabular-nums">{packagePriceLabel(cheapest)}</span> }]
      : []),
    ...(freeLessons > 0
      ? [{ key: "free", label: "Free lessons", value: <span className="tabular-nums">{freeLessons}</span> }]
      : []),
    instructors.length === 1
      ? {
          key: "faculty",
          label: "Taught by",
          value: (
            <>
              <Avatar className="size-6 shrink-0">
                {instructors[0].avatarUrl && <AvatarImage src={instructors[0].avatarUrl} alt="" />}
                <AvatarFallback className="bg-ws-raised text-[10px] font-semibold text-ws-primary">
                  {initialsOf(instructors[0].name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate">{instructors[0].name}</span>
            </>
          ),
        }
      : { key: "faculty", label: "Instructors", value: <span className="tabular-nums">{instructors.length}</span> },
    ...(learners > 0
      ? [{ key: "learners", label: "Learners", value: <span className="tabular-nums">{learners.toLocaleString("en-US")}</span> }]
      : []),
    ...(rating && rating.count > 0
      ? [
          {
            key: "rating",
            label: rating.count === 1 ? "From 1 rating" : `From ${rating.count.toLocaleString("en-US")} ratings`,
            value: (
              <>
                <span className="tabular-nums">{rating.average.toFixed(1)}</span>
                <StarIcon size={15} fill="currentColor" strokeWidth={0} className="text-ws-rating" aria-hidden />
                <span className="sr-only">out of 5</span>
              </>
            ),
          },
        ]
      : []),
  ]

  // lg: one row of facts divided by hairlines, wrapping when a school has
  // more facts than the row holds. Every fact carries its divider on its left
  // and the list is pulled one gutter left inside a clipping box, so the
  // first fact of each row — whichever that is — has its divider cut off.
  return (
    <div
      className={cn(
        "rise mt-10 border-t border-ws-hairline pt-6",
        onArt && "lg:mt-0 lg:overflow-hidden lg:border-white/12 lg:pb-8 lg:pt-6"
      )}
      style={rise(6)}
    >
      <dl
        className={cn(
          "grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3",
          onArt && "lg:-ml-7 lg:flex lg:flex-wrap lg:gap-x-0 lg:gap-y-5"
        )}
      >
        {facts.map((fact) => (
          <div key={fact.key} className={cn("min-w-0", onArt && "lg:border-l lg:border-white/12 lg:px-7")}>
            <dt className={label}>{fact.label}</dt>
            <dd className={value}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
