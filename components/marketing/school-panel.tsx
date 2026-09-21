"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { motion, useMotionValue, useTransform, type MotionValue } from "motion/react"
import type { School } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { SchoolIcon } from "@/components/shared/school-icon"
import { cn } from "@/lib/utils"

const LEAD = "School of "

/**
 * One school in the landing's Schools showcase (moment 2) — a large panel of
 * the school's path-traced cover, its number, name, blurb, program count with
 * the cheapest price, and one affordance. The WHOLE panel is the link.
 *
 * The panel is a size container with two compositions, so the server HTML is
 * already right at every width (no JS layout switch):
 *   · narrow (< 32rem — the swipe row on phones, tablets and reduced motion):
 *     the cover on top, copy below, the number set over the cover's dark
 *     left side;
 *   · wide (≥ 32rem — the pinned stage at lg+): the cover full-bleed and the
 *     copy in a column over its left. The renders put their subject right of
 *     centre on a dark ground, so the column sits on empty backdrop. On short
 *     screens (≤ 780px tall, where the panel is ~480px) the number and the
 *     copy's spacing tighten and the blurb clamps to two lines, so the number
 *     never meets the copy.
 *
 * The panel is a dark island (`data-ws-theme="platform"`): the art is dark in
 * both modes, so the copy over it keeps the dark palette's ink — the same
 * token scoping `certificate-view.tsx` uses for its paper island.
 *
 * `stage` is the stage's fractional active index (0 = the first panel on
 * stage, 7 = the last). When given, the panel moves with it in three planes:
 * the cover drifts against the panel's travel (farther), the copy arrives
 * slightly ahead of it (nearer) and fades in as the panel reaches the stage,
 * and a page-coloured shade dims whichever panels are not on stage. The shade
 * sits OUTSIDE the island so panels recede toward the page in either mode.
 * Without `stage` nothing moves.
 */
export function SchoolPanel({
  school,
  index,
  count,
  fromPrice,
  stage,
  onFocus,
}: {
  school: School
  /** 0-based position — renders as "01". */
  index: number
  count: number
  /** Cheapest program in the school, whole USD; 0 = free; null hides it. */
  fromPrice: number | null
  stage?: MotionValue<number>
  onFocus?: React.FocusEventHandler<HTMLAnchorElement>
}) {
  const idle = useMotionValue(0)
  const r = useTransform(stage ?? idle, (v) => v - index)
  const artX = useTransform(r, [-1.2, 0, 1.2], ["-6%", "0%", "6%"])
  const copyX = useTransform(r, [-1, 0, 1], [80, 0, -28])
  const copyOpacity = useTransform(r, [-0.8, -0.2], [0, 1])
  const shade = useTransform(r, [-1.6, -1, -0.3, 0.3, 1, 1.6], [0.62, 0.46, 0, 0, 0.46, 0.62])

  const cover = schoolCover(school.slug)
  const lead = school.name.startsWith(LEAD) ? LEAD.trim() : null
  const title = lead ? school.name.slice(LEAD.length) : school.name
  const programs = count === 1 ? "1 program" : `${count} programs`
  const price = fromPrice === null ? null : fromPrice === 0 ? "Free" : `$${fromPrice.toLocaleString("en-US")}`
  const number = String(index + 1).padStart(2, "0")

  return (
    <div className="relative h-full">
      <Link
        href={`/schools/${school.slug}`}
        data-ws-theme="platform"
        onFocus={onFocus}
        className="group @container relative flex h-full flex-col overflow-hidden rounded-[20px] bg-ws-surface text-ws-primary outline-none"
      >
        {/* The cover — on top when narrow, full-bleed when wide. */}
        <div
          aria-hidden
          className="relative aspect-[16/10] shrink-0 overflow-hidden bg-ws-sunken @min-[32rem]:absolute @min-[32rem]:inset-0 @min-[32rem]:aspect-auto"
        >
          {cover ? (
            <motion.div
              className={cn("absolute inset-0 @min-[32rem]:-inset-x-[7%]", stage && "will-change-transform")}
              style={stage ? { x: artX } : undefined}
            >
              <Image
                src={cover}
                alt=""
                fill
                loading="eager"
                sizes="(min-width: 1024px) 66vw, 26rem"
                className="object-cover object-[62%_50%]"
              />
            </motion.div>
          ) : (
            <span className="flex h-full items-center justify-center text-ws-muted @min-[32rem]:justify-end @min-[32rem]:pr-[18%]">
              <SchoolIcon name={school.icon} size={56} />
            </span>
          )}
          {/* Narrow: the cover settles into the card body. */}
          <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ws-surface to-transparent @min-[32rem]:hidden" />
          {/* Wide: the copy column's ground — the render's own backdrop, deepened. */}
          <span className="absolute inset-0 hidden bg-[linear-gradient(90deg,var(--ws-bg-page)_0%,color-mix(in_oklab,var(--ws-bg-page)_88%,transparent)_30%,color-mix(in_oklab,var(--ws-bg-page)_50%,transparent)_50%,transparent_70%)] @min-[32rem]:block" />
          <span className="absolute inset-x-0 bottom-0 hidden h-1/2 bg-gradient-to-t from-ws-page/70 to-transparent @min-[32rem]:block" />
        </div>

        {/* The number — over the cover's dark left side when narrow, the column's head when wide. */}
        <motion.span
          aria-hidden
          style={stage ? { x: copyX, opacity: copyOpacity } : undefined}
          className={cn(
            stage && "will-change-[transform,opacity]",
            "absolute left-5 top-3.5 font-display text-[2.5rem] font-light leading-none tracking-[-0.04em] tabular-nums text-ws-primary/90 @min-[32rem]:left-[clamp(1.75rem,5.5cqi,3.25rem)] @min-[32rem]:top-[clamp(1.5rem,5cqi,2.75rem)] @min-[32rem]:text-[clamp(3.5rem,11cqi,6.5rem)] @min-[32rem]:[@media(max-height:780px)]:top-[clamp(1.25rem,4cqi,2rem)] @min-[32rem]:[@media(max-height:780px)]:text-[clamp(3rem,8cqi,4.25rem)]"
          )}
        >
          {number}
        </motion.span>

        {/* The copy — below the cover when narrow, a column over its left when wide. */}
        <motion.div
          style={stage ? { x: copyX, opacity: copyOpacity } : undefined}
          className={cn(
            stage && "will-change-[transform,opacity]",
            "flex flex-1 flex-col p-5 pt-1 @min-[32rem]:absolute @min-[32rem]:inset-y-0 @min-[32rem]:left-0 @min-[32rem]:w-[min(50%,30rem)] @min-[48rem]:w-[min(48%,30rem)] @min-[32rem]:justify-end @min-[32rem]:p-[clamp(1.75rem,5.5cqi,3.25rem)]"
          )}
        >
          <h3 className="font-display">
            {lead && (
              <span className="mb-2 block text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-ws-muted @min-[32rem]:mb-3 @min-[32rem]:text-[12px]">
                {lead}
              </span>
            )}{" "}
            <span className="block text-[21px] font-semibold leading-[1.15] tracking-[-0.015em] text-ws-primary @min-[32rem]:text-[clamp(1.75rem,4.6cqi,2.75rem)] @min-[32rem]:leading-[1.06] @min-[32rem]:tracking-[-0.025em]">
              {title}
            </span>
          </h3>
          <p className="mt-2.5 text-[14px] leading-relaxed text-ws-muted @min-[32rem]:mt-4 @min-[32rem]:text-[clamp(0.9375rem,1.6cqi,1.0625rem)] @min-[32rem]:[@media(max-height:780px)]:mt-3 @min-[32rem]:[@media(max-height:780px)]:line-clamp-2">
            {school.blurb}
          </p>

          <span className="mt-auto flex items-center justify-between gap-3 pt-5 text-[13px] @min-[32rem]:mt-7 @min-[32rem]:flex-col @min-[32rem]:items-start @min-[32rem]:gap-5 @min-[32rem]:border-t @min-[32rem]:border-ws-hairline @min-[32rem]:pt-5 @min-[32rem]:[@media(max-height:780px)]:mt-5 @min-[32rem]:[@media(max-height:780px)]:gap-4 @min-[32rem]:[@media(max-height:780px)]:pt-4">
            <span className="shrink-0 whitespace-nowrap tabular-nums text-ws-muted">
              {programs}
              {price && (
                <>
                  {" · "}
                  {fromPrice === 0 ? null : "from "}
                  <span className="font-semibold text-ws-primary">{price}</span>
                </>
              )}
            </span>
            <span className="inline-flex items-center gap-3 font-semibold text-ws-primary">
              <span className="hidden text-[14px] @min-[32rem]:inline">Explore school</span>
              <span className="flex size-9 items-center justify-center rounded-full bg-ws-primary/10 ring-1 ring-ws-primary/10 transition-colors duration-[var(--ws-motion-base)] group-hover:bg-ws-primary/20 @min-[32rem]:size-10">
                <ArrowRightIcon
                  size={16}
                  aria-hidden
                  className="transition-transform duration-200 ease-[var(--ws-ease)] group-hover:translate-x-0.5"
                />
              </span>
            </span>
          </span>
        </motion.div>

        {/* Focus ring — its own top layer: an outline on the link itself paints under the positioned art. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 ring-2 ring-inset ring-ws-brand group-focus-visible:opacity-100"
        />
      </Link>

      {/* Off-stage shade — the page's own colour, so panels recede toward it in
          both modes; lighter on paper, where a full wash over dark art turns grey. */}
      {stage && (
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-100">
          <motion.span style={{ opacity: shade }} className="absolute inset-0 rounded-[20px] bg-ws-page will-change-[opacity]" />
        </span>
      )}
    </div>
  )
}
