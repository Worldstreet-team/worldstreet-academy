import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { School } from "@/lib/schools"
import { SchoolIcon } from "@/components/shared/school-icon"

/**
 * One school card (spec §4) for the /schools index: icon in a gold wash,
 * name, blurb, program count and the [EXPLORE SCHOOL] affordance. The WHOLE
 * card is the link — one tab stop, one accessible name — so a grid of eight
 * stays navigable. v2 card shape: `card` fill, 20px corners, fill-separated
 * in dark (hairline in light), hover lifts one ladder step. Server-safe (no
 * hooks). The landing lists the schools as a directory instead
 * (schools-grid.tsx).
 *
 * Motion: the `ws-school` class plus `data-school` pick up that school's own
 * hover gesture — eight of them, one per subject, defined under "School
 * cards — one signature motion per school" in app/globals.css. The card
 * never scales; only the glyph moves, and nothing moves under reduced
 * motion.
 */
export function SchoolCard({
  school,
  count,
  headingLevel = "h3",
}: {
  school: School
  count: number
  /** h3 under a section h2 (landing); h2 under the page h1 (/schools). */
  headingLevel?: "h2" | "h3"
}) {
  const Heading = headingLevel
  return (
    <Link
      href={`/schools/${school.slug}`}
      data-school={school.slug}
      className="ws-school group flex h-full flex-col rounded-[20px] border border-ws-hairline bg-ws-surface p-7 transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ws-brand/[0.12] text-ws-gold transition-colors duration-[var(--ws-motion-base)] group-hover:bg-ws-brand/[0.18]">
        <span className="ws-school-glyph">
          <SchoolIcon name={school.icon} size={20} />
        </span>
      </span>
      <Heading className="mt-6 font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
        {school.name}
      </Heading>
      <p className="mb-7 mt-2.5 text-[14px] leading-relaxed text-ws-muted">{school.blurb}</p>
      <span className="mt-auto flex items-center justify-between gap-3 border-t border-ws-hairline pt-5 text-[13px]">
        <span className="tabular-nums text-ws-muted">
          {count === 1 ? "1 program" : `${count} programs`}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
          Explore school
          <ArrowRightIcon
            size={14}
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </Link>
  )
}
