import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon } from "lucide-react"
import type { School } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { SchoolIcon } from "@/components/shared/school-icon"

/** Four across from lg (the landing and /dashboard/start): ~300px cards. */
const FOUR_ACROSS_SIZES = "(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"

/**
 * One school card (spec §4): cover art, icon chip, name, blurb, program count
 * with the cheapest price, and one affordance. The WHOLE card is the link.
 * With no cover yet the art area shows the school's glyph, so the grid never
 * has an empty box.
 *
 * Motion: the `ws-school` class plus `data-school` pick up that school's own
 * hover gesture — eight of them, one per subject, defined under "School
 * cards — one signature motion per school" in app/globals.css. The card
 * never scales; only the glyph and the cover move, and nothing moves under
 * reduced motion.
 *
 * The card chrome never scales: hover lightens one surface step. The image
 * takes the one sanctioned zoom (1 → 1.03 inside its clipped frame, 600 ms
 * `--ws-ease-rise`) — the same exception `MarketingCourseCard` already uses,
 * so school and program cards move alike — and brightens as the scrim over
 * it fades. The scrim, not the image's own opacity, does the dimming: these
 * renders are dark, and a translucent image over the light theme's paper
 * would turn their blacks to haze.
 *
 * The card is a size container: below ~21rem the footer keeps the count and
 * price and drops the `cta` words to the arrow alone, so a four-across row
 * never wraps its footer onto two lines.
 */
export function SchoolCard({
  school,
  count,
  fromPrice = null,
  headingLevel = "h3",
  href,
  cta = "Explore school",
  priority = false,
  sizes = FOUR_ACROSS_SIZES,
}: {
  school: School
  count: number
  /** Cheapest program in the school, whole USD; 0 = free; null hides it. */
  fromPrice?: number | null
  /** h3 under a section h2 (landing); h2 under the page h1 (/schools, /dashboard/start). */
  headingLevel?: "h2" | "h3"
  /** Defaults to the public school page. */
  href?: string
  cta?: string
  /** First-row cards above the fold. */
  priority?: boolean
  /** The cover's `sizes`; defaults to a four-across grid. */
  sizes?: string
}) {
  const Heading = headingLevel
  const cover = schoolCover(school.slug)
  const programs = count === 1 ? "1 program" : `${count} programs`
  const price = fromPrice === null ? null : fromPrice === 0 ? "Free" : `$${fromPrice.toLocaleString("en-US")}`

  return (
    <Link
      href={href ?? `/schools/${school.slug}`}
      data-school={school.slug}
      className="ws-school group @container flex h-full flex-col overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface transition-colors duration-[var(--ws-motion-base)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 dark:border-transparent"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ws-sunken">
        {cover ? (
          <>
            <Image
              src={cover}
              alt=""
              fill
              priority={priority}
              sizes={sizes}
              className="object-cover transition-transform duration-600 ease-[var(--ws-ease-rise)] motion-safe:group-hover:scale-[1.03]"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-[var(--ws-overlay-scrim)] opacity-25 transition-opacity duration-600 ease-[var(--ws-ease-rise)] group-hover:opacity-0"
            />
          </>
        ) : (
          <span className="flex h-full items-center justify-center text-ws-gold">
            <span className="ws-school-glyph">
              <SchoolIcon name={school.icon} size={44} />
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        {cover && (
          <span className="relative z-10 -mt-11 mb-4 flex h-10 w-10 items-center justify-center rounded-[9px] bg-ws-surface text-ws-gold ring-1 ring-ws-hairline transition-colors duration-[var(--ws-motion-base)] group-hover:bg-ws-raised">
            <span className="ws-school-glyph">
              <SchoolIcon name={school.icon} size={18} />
            </span>
          </span>
        )}
        <Heading className="font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ws-primary">
          {school.name}
        </Heading>
        <p className="mb-6 mt-2 text-[14px] leading-relaxed text-ws-muted">{school.blurb}</p>
        <span className="mt-auto flex items-center justify-between gap-3 whitespace-nowrap border-t border-ws-hairline pt-4 text-[13px]">
          <span className="shrink-0 tabular-nums text-ws-muted">
            {programs}
            {price && (
              <>
                {" · "}
                {fromPrice === 0 ? null : "from "}
                <span className="font-semibold text-ws-primary">{price}</span>
              </>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ws-muted transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
            <span className="hidden truncate @min-[21rem]:block">{cta}</span>
            <ArrowRightIcon size={14} aria-hidden className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </span>
      </div>
    </Link>
  )
}
