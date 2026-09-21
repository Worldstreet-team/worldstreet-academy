import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon, CalendarClockIcon, StarIcon } from "lucide-react"
import type { School } from "@/lib/schools"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { levelChipStyle } from "@/components/shared/level-badge"
import { SchoolIcon } from "@/components/shared/school-icon"
import { initialsOf, plural } from "@/components/programs/format"
import { SCHOOL_SECTION, SectionHead } from "@/components/schools/section-head"
import { opensLabel, sizeLine, type SchoolProgram } from "@/components/schools/model"

/**
 * `#programs` — the core of the page. Big, image-led program cards whose
 * layout follows the count: one program is a single wide feature card, two
 * are a pair of large cards, three or more a grid. Each card is one link to
 * the program page; its affordance is ink, never gold — a row of gold buttons
 * would outshout the one action the page is for.
 *
 * With no programs yet the section says so plainly and points somewhere
 * useful, instead of leaving a dashed hole.
 */
export function SchoolPrograms({ school, programs }: { school: School; programs: SchoolProgram[] }) {
  const count = programs.length

  return (
    <section id="programs" aria-labelledby="programs-heading" className={SCHOOL_SECTION}>
      <SectionHead
        id="programs-heading"
        title={count > 1 ? "Choose your program" : count === 1 ? "The program" : "Programs"}
        lede={
          count > 1
            ? "Each program's page has its full curriculum and the packages to choose from."
            : count === 1
              ? "Its page has the full curriculum and the packages to choose from."
              : undefined
        }
        aside={
          count > 1 ? (
            <p className="text-[14px] tabular-nums text-ws-muted">{plural(count, "program")}</p>
          ) : undefined
        }
      />

      {count === 0 ? (
        <EmptyPrograms school={school} />
      ) : count === 1 ? (
        <div className="mt-10">
          <ProgramCard item={programs[0]} variant="feature" />
        </div>
      ) : (
        // Four sit two by two; three, or five and up, three across.
        <ul className={cn("mt-10 grid gap-5 md:grid-cols-2", count > 2 && count !== 4 && "lg:grid-cols-3")}>
          {programs.map((item) => (
            <li key={item.program.id} className="flex min-w-0">
              <ProgramCard item={item} variant={count === 2 || count === 4 ? "large" : "grid"} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const SIZES = {
  feature: "(min-width: 1280px) 660px, (min-width: 1024px) 53vw, 100vw",
  large: "(min-width: 1280px) 606px, (min-width: 768px) 50vw, 100vw",
  grid: "(min-width: 1280px) 397px, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw",
} as const

function ProgramCard({ item, variant }: { item: SchoolProgram; variant: "feature" | "large" | "grid" }) {
  const { program, facts, comingSoon } = item
  const feature = variant === "feature"
  // The feature card's outcomes are the "What you'll learn here" section right
  // below it, in full; the smaller cards peek at their first three.
  const peek = feature ? [] : program.whatYouWillLearn.slice(0, 3)
  const more = program.whatYouWillLearn.length - peek.length
  const size = sizeLine(facts)
  const rated = program.rating !== null && program.ratingCount > 0
  const free = program.pricing === "free" || !program.price
  const description = program.shortDescription ?? program.description

  return (
    <Link
      href={`/programs/${program.slug}`}
      className={cn(
        "group flex w-full flex-col overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent",
        feature && "lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
      )}
    >
      {/* The feature card's art keeps 16:11 on lg and stretches with a taller text column. */}
      <div className={cn("relative aspect-[16/9] overflow-hidden bg-ws-sunken", feature && "lg:aspect-[16/11]")}>
        {program.thumbnailUrl ? (
          <Image src={program.thumbnailUrl} alt="" fill sizes={SIZES[variant]} className="object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-ws-muted">
            <SchoolIcon name="graduation-cap" size={40} aria-hidden />
          </span>
        )}
        {comingSoon && program.availableAt && (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[12.5px] font-semibold text-white">
            <CalendarClockIcon size={13} aria-hidden />
            {opensLabel(program.availableAt)}
          </span>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col p-6 sm:p-7", feature && "lg:p-10")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold capitalize"
            style={levelChipStyle(program.level)}
          >
            {program.level}
          </span>
          {program.tierCount > 1 && (
            <span className="text-[13px] tabular-nums text-ws-muted">{plural(program.tierCount, "package")}</span>
          )}
        </div>

        <h3
          className={cn(
            "mt-4 text-balance font-display font-semibold leading-[1.15] tracking-[-0.02em] text-ws-primary",
            feature ? "text-[26px] sm:text-[32px]" : variant === "large" ? "text-[24px] sm:text-[26px]" : "text-[21px]"
          )}
        >
          {program.title}
        </h3>
        {description && (
          <p
            className={cn(
              "mt-3 text-pretty leading-relaxed text-ws-muted",
              feature ? "text-[16px] sm:text-[17px]" : "line-clamp-3 text-[15px]"
            )}
          >
            {description}
          </p>
        )}

        {/* The one program of its school has no compare table beside it, so
            its card says what it includes — the program page's own list. */}
        {feature && item.includes.length > 0 && (
          <div className="mt-6">
            <p className="text-[13px] font-semibold text-ws-primary">This program includes</p>
            <ul className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {item.includes.map(({ icon: Icon, label, tier }) => (
                <li key={label} className="flex items-center gap-3 text-[14.5px] leading-snug text-ws-primary/90">
                  <Icon size={16} className="shrink-0 text-ws-muted" aria-hidden />
                  <span className="min-w-0">
                    {label}
                    {tier && (
                      <span className="ml-2 whitespace-nowrap rounded-full border border-ws-hairline px-2 py-0.5 text-[11.5px] font-medium text-ws-muted">
                        <span className="sr-only">with the </span>
                        {PACKAGE_LABEL[tier]}
                        <span className="sr-only"> package</span>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {peek.length > 0 && (
          <div className="mt-6">
            <p className="text-[13px] font-semibold text-ws-primary">You&apos;ll learn</p>
            <ul className={cn("mt-3 grid gap-x-8 gap-y-2.5", feature && "sm:grid-cols-2")}>
              {peek.map((line) => (
                <li key={line} className="flex items-start gap-3 text-[14.5px] leading-snug text-ws-primary/90">
                  <span aria-hidden className="mt-[0.45em] size-1.5 shrink-0 rounded-full ring-[1.5px] ring-ws-muted" />
                  {line}
                </li>
              ))}
            </ul>
            {more > 0 && (
              <p className="mt-3 text-[13px] tabular-nums text-ws-muted">
                and {plural(more, "more topic")}
              </p>
            )}
          </div>
        )}

        <div className="mt-auto pt-7">
          <p className="flex min-w-0 items-center gap-2 text-[13.5px]">
            <Avatar className="size-6 shrink-0">
              {program.instructorAvatarUrl && <AvatarImage src={program.instructorAvatarUrl} alt="" />}
              <AvatarFallback className="bg-ws-raised text-[10px] font-semibold text-ws-primary">
                {initialsOf(program.instructorName)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-ws-primary">{program.instructorName}</span>
          </p>
          {/* One run of text, so a wrap never strands a separator at the start of a line. */}
          {(rated || size.length > 0) && (
            <p className="mt-2.5 text-[13.5px] leading-relaxed tabular-nums text-ws-muted">
              {rated && program.rating !== null && (
                <>
                  <StarIcon
                    size={13}
                    fill="currentColor"
                    strokeWidth={0}
                    className="-mt-0.5 mr-1 inline text-ws-rating"
                    aria-hidden
                  />
                  <span className="font-semibold text-ws-primary">{program.rating.toFixed(1)}</span>
                  <span className="sr-only"> out of 5</span> ({plural(program.ratingCount, "rating")})
                  {size.length > 0 && " · "}
                </>
              )}
              {size.join(" · ")}
            </p>
          )}

          <div className="mt-5 flex items-end justify-between gap-4 border-t border-ws-hairline pt-5">
            <p className="flex items-baseline gap-1.5">
              {!free && program.tierCount > 1 && <span className="text-[13px] font-medium text-ws-muted">From</span>}
              <span className="font-display text-[26px] font-light leading-none tabular-nums tracking-[-0.02em] text-ws-primary">
                {free ? "Free" : `$${program.price?.toLocaleString("en-US")}`}
              </span>
            </p>
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ws-primary">
              View program
              <ArrowRightIcon
                size={15}
                aria-hidden
                className="transition-transform duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function EmptyPrograms({ school }: { school: School }) {
  return (
    <div className="mt-10 grid items-center gap-8 rounded-[20px] border border-ws-hairline bg-ws-surface p-8 dark:border-transparent md:grid-cols-[auto_minmax(0,1fr)] md:gap-10 md:p-12">
      <span className="flex size-16 items-center justify-center rounded-full bg-ws-raised text-ws-primary">
        <SchoolIcon name={school.icon} size={26} aria-hidden />
      </span>
      <div className="max-w-xl">
        <h3 className="font-display text-[22px] font-semibold tracking-[-0.015em] text-ws-primary">
          The first programs are on their way
        </h3>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ws-muted">
          The {school.short} programs are being prepared and aren&apos;t open yet. Until they are, explore what
          the other schools teach.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#other-schools"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-ws-hairline px-5 text-[14px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            See the other schools
          </a>
          <Link
            href="/programs"
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            Browse all programs
            <ArrowRightIcon size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  )
}
