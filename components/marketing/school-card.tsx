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
      className="group flex h-full flex-col rounded-[20px] border border-ws-hairline bg-ws-surface p-6 transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ws-brand/[0.12] text-ws-gold">
        <SchoolIcon name={school.icon} size={18} />
      </span>
      <Heading className="mt-6 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
        {school.name}
      </Heading>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ws-muted">{school.blurb}</p>
      <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-[13px]">
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
