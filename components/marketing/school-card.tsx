import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { School } from "@/lib/schools"
import { SchoolIcon } from "@/components/shared/school-icon"
import { cn } from "@/lib/utils"

/**
 * One school card (spec §4): icon in a gold wash, name, blurb, program count
 * and the [EXPLORE SCHOOL] affordance. The WHOLE card is the link — one tab
 * stop, one accessible name — so a grid of eight stays navigable. Server-safe
 * (no hooks): used by the landing grid and the /schools index.
 */
export function SchoolCard({
  school,
  count,
  headingLevel = "h3",
  className,
}: {
  school: School
  count: number
  /** h3 under a section h2 (landing); h2 under the page h1 (/schools). */
  headingLevel?: "h2" | "h3"
  className?: string
}) {
  const Heading = headingLevel
  return (
    <Link
      href={`/schools/${school.slug}`}
      className={cn(
        "group flex h-full flex-col rounded-lg border border-ws-hairline bg-ws-surface p-6 transition-colors duration-[var(--ws-motion-base)] hover:border-ws-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ws-brand/10 text-ws-gold">
        <SchoolIcon name={school.icon} size={18} />
      </span>
      <Heading className="mt-5 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
        {school.name}
      </Heading>
      <p className="mt-2 text-[13px] leading-relaxed text-ws-muted">{school.blurb}</p>
      <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-[13px]">
        <span className="tabular-nums text-ws-subtle">
          {count === 1 ? "1 program" : `${count} programs`}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-ws-gold">
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
