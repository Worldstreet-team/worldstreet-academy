import { ArrowRightIcon } from "@/components/icons"
import Link from "next/link"
import { cohortDateLabel, cohortDateShort } from "@/lib/cohort"
import type { CohortView } from "@/lib/cohort-rules"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { cn } from "@/lib/utils"
import { CardShell, Eyebrow } from "@/components/ui/system"
import { CohortCountdown, WhileCohortUpcoming } from "@/components/shared/cohort-countdown"
import { GOLD_CTA } from "@/components/schools/cta"

type Props = (
  | { variant: "bar" }
  | { variant: "band"; className?: string }
  | {
      variant: "strip"
      /** One line under the headline: what to do on this page to join. */
      note?: string
      className?: string
    }
) & { cohort: CohortView | null }

/**
 * Institutional blueprint §18: the band names its cohort ("Cohort 001 —
 * Starts Monday 19 October") and offers Explore Programs / Join Cohort.
 * "Live cohort begins on the 19th" — the owner's countdown and call to action
 * (meeting 2026-10-03: join the upcoming cohort, choose your school, choose
 * your program, pay now to join). The cohort comes from
 * `getCohortCalendar().next` (lib/cohort-calendar.ts); every variant renders nothing once the cohort has begun —
 * on the server, and in the browser for a page cached from before it.
 *
 *   bar    one line above the navbar on every marketing page, the whole bar a
 *          link to /schools; its copy shortens on small screens so it stays
 *          one line at 360px
 *   band   the landing's section right after the hero: headline, pitch, the
 *          block countdown and the gold "Choose your school"
 *   strip  a compact card for the schools and program pages, beside the
 *          choice it asks for (the school list, a school's programs, the
 *          packages); no action of its own, since the choice is right there
 *
 * The owner asked for "a red button"; the primary action stays the system's
 * gold, and red appears only as the static live dot (the danger token).
 */
export function CohortBanner(props: Props) {
  const { cohort } = props
  if (!cohort) return null
  return (
    <WhileCohortUpcoming startsAt={cohort.startsAt}>
      {props.variant === "bar" ? (
        <CohortBar cohort={cohort} />
      ) : props.variant === "band" ? (
        <CohortBand cohort={cohort} className={props.className} />
      ) : (
        <CohortStrip cohort={cohort} note={props.note} className={props.className} />
      )}
    </WhileCohortUpcoming>
  )
}

/** The "live" signal: a small static red dot (no pulse — no ambient loops). */
function LiveDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full bg-ws-danger", className)} />
}

function LiveEyebrow() {
  return (
    <Eyebrow className="inline-flex items-center gap-2 text-ws-primary">
      <LiveDot />
      Live cohort
    </Eyebrow>
  )
}

function CohortBar({ cohort }: { cohort: CohortView }) {
  return (
    <Link
      href="/schools"
      className="group block border-b border-ws-hairline bg-ws-surface transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40"
    >
      {/* One line at 360px: below md the date shortens, below sm the action
          does too and the second separator drops. The countdown reserves its
          width before it mounts, so the centred line never jumps when the
          time appears. */}
      <span className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-2 overflow-hidden whitespace-nowrap px-4 text-[12px] sm:gap-3 sm:px-6 sm:text-[13px]">
        <span className="flex items-center gap-2 font-semibold text-ws-primary">
          <LiveDot />
          <span className="md:hidden">
            {cohort.name} starts {cohortDateShort(cohort.startsAt)}
          </span>
          <span className="hidden md:inline">
            {cohort.name} starts {cohortDateLabel(cohort.startsAt)}
          </span>
        </span>
        <CohortCountdown startsAt={cohort.startsAt} variant="compact" prefix="· " className="inline-block min-w-[8.9em] text-ws-muted" />
        <span aria-hidden className="hidden text-ws-subtle sm:inline">
          ·
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-ws-primary">
          <span className="sm:hidden">Join</span>
          <span className="hidden sm:inline">Choose your school</span>
          <ArrowRightIcon
            size={13}
            aria-hidden
            className="transition-transform duration-[var(--ws-motion-fast)] ease-[var(--ws-ease)] group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
      </span>
    </Link>
  )
}

function CohortBand({ cohort, className }: { cohort: CohortView; className?: string }) {
  return (
    <section id="cohort" aria-labelledby="cohort-heading" className={cn("mx-auto max-w-7xl scroll-mt-24 px-6", className)}>
      <CardShell className="gap-8 p-6 sm:p-8 md:p-10 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
        <div>
          <LiveEyebrow />
          <h2
            id="cohort-heading"
            className="mt-4 text-balance font-display text-[clamp(1.875rem,3.2vw,2.625rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ws-primary"
          >
            {`${cohort.name} — Starts ${cohortDateLabel(cohort.startsAt)}`}
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-ws-muted md:text-[17px]">
            Learn live with your tutor, rewatch every class from your dashboard, and choose the plan that fits:{" "}
            {PACKAGE_LABEL.basic}, {PACKAGE_LABEL.standard} or {PACKAGE_LABEL.executive}.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/programs"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 sm:w-auto"
            >
              Explore Programs
            </Link>
            <Link href="/schools" className={cn(GOLD_CTA, "w-full sm:w-auto")}>
              Join Cohort
            </Link>
          </div>
        </div>
        {/* Phones: four equal tiles across the card; from sm, fixed tiles.
            The min sizes hold the tiles' room before they mount, so the
            headline never re-wraps when the time appears. */}
        <CohortCountdown
          startsAt={cohort.startsAt}
          variant="blocks"
          className="flex min-h-[78px] w-full gap-2 sm:min-h-[94px] sm:w-auto sm:min-w-[22.25rem] sm:gap-3"
          blockClassName="min-w-0 flex-1 bg-ws-chip px-2 py-3 sm:min-w-20 sm:flex-none sm:py-4 [&>span:first-child]:text-[28px] sm:[&>span:first-child]:text-[34px] [&>span:last-child]:mt-1 [&>span:last-child]:text-[10px]"
        />
      </CardShell>
    </section>
  )
}

function CohortStrip({ cohort, note, className }: { cohort: CohortView; note?: string; className?: string }) {
  return (
    <CardShell
      className={cn(
        "gap-5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between md:gap-8",
        className
      )}
    >
      <div className="min-w-0">
        <LiveEyebrow />
        <p className="mt-2 text-balance font-display text-[19px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary sm:text-[21px]">
          {`${cohort.name} — Starts ${cohortDateLabel(cohort.startsAt)}`}
        </p>
        {note && <p className="mt-1.5 text-pretty text-[14.5px] leading-relaxed text-ws-muted">{note}</p>}
      </div>
      {/* min sizes: the tiles' room, held before they mount. */}
      <CohortCountdown startsAt={cohort.startsAt} variant="blocks" className="flex min-h-12 min-w-[15.5rem] shrink-0" />
    </CardShell>
  )
}
