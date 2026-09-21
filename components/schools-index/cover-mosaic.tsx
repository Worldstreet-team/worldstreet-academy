"use client"

import * as React from "react"
import Image from "next/image"
import { motion, useScroll, useTransform } from "motion/react"
import type { SchoolSlug } from "@/lib/schools"
import { useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { SchoolIcon } from "@/components/shared/school-icon"
import { cn } from "@/lib/utils"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { plural, type IndexSchool } from "./model"

/**
 * The header's collage: the eight path-traced covers as a 4 × 2 wall, one
 * tile per school in the spec's order, each a jump to that school's entry
 * further down the page.
 *
 * Composition (lg+): the four columns sit at staggered heights (CSS, so the
 * server HTML is already the final layout), and as the page scrolls each
 * column drifts at its own rate — near columns a little faster than the page,
 * far ones a little slower — so the wall reads as depth, not a flat grid.
 * Below lg it is a plain, even 4 × 2 grid. Names show where a tile is wide
 * enough to hold one (sm–lg, where the header stacks, and xl+); phones and
 * the lg–xl squeeze beside the headline show numbers only.
 *
 * The one load sequence: tiles unveil bottom-up in reading order (a clip, not
 * a fade) while each render settles from a slight zoom. While the visitor
 * searches, tiles of schools with no match dim, so the wall answers as they
 * type. Reduced motion: no unveil, no drift; the dimming stays (it carries
 * meaning, and it is opacity only).
 *
 * The tiles are dark islands (`data-ws-theme="platform"`): the renders are
 * dark in both modes, so the ink over them keeps the dark palette.
 */

/** Resting stagger per column (lg+). */
const STAGGER = ["lg:translate-y-10", "lg:translate-y-0", "lg:translate-y-16", "lg:translate-y-4"] as const

/** Drift per column over the first `DRIFT_RANGE` px of scroll: negative rises faster than the page (nearer). */
const DRIFT = [-44, 36, -88, 20] as const
const DRIFT_RANGE = 900

/** The renders sit right of centre; a portrait crop keeps the subject in frame. */
const FOCUS = "object-[82%_50%]"

export function CoverMosaic({
  schools,
  lit,
  onJump,
}: {
  schools: readonly IndexSchool[]
  /** Schools the current search keeps; null when nothing is filtered. */
  lit: ReadonlySet<SchoolSlug> | null
  onJump: (slug: SchoolSlug) => void
}) {
  const ok = useMotionOK()
  const lg = useMediaQuery("(min-width: 1024px)")
  const drift = ok && lg
  const { scrollY } = useScroll()

  return (
    <nav aria-label="Jump to a school" className="relative">
      {/* Ambient gold glow — the design system's one sanctioned hero wash, static. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-16 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,var(--ws-glow-brand),transparent)] opacity-90"
      />
      <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:pb-16">
        {schools.map((school, i) => (
          <Tile
            key={school.slug}
            school={school}
            index={i}
            ok={ok}
            drift={drift}
            scrollY={scrollY}
            dim={lit !== null && !lit.has(school.slug)}
            onJump={onJump}
          />
        ))}
      </ul>
    </nav>
  )
}

function Tile({
  school,
  index,
  ok,
  drift,
  scrollY,
  dim,
  onJump,
}: {
  school: IndexSchool
  index: number
  ok: boolean
  drift: boolean
  scrollY: ReturnType<typeof useScroll>["scrollY"]
  dim: boolean
  onJump: (slug: SchoolSlug) => void
}) {
  const col = index % 4
  const y = useTransform(scrollY, [0, DRIFT_RANGE], [0, DRIFT[col]])
  const count = school.programs.length
  const icon = SCHOOL_BY_SLUG[school.slug].icon
  const delay = 0.15 + index * 0.07

  return (
    <li className={cn("transition-opacity duration-[var(--ws-motion-base)]", STAGGER[col], dim && "opacity-25")}>
      <motion.div style={drift ? { y } : undefined} className={cn(drift && "will-change-transform")}>
        <a
          href={`#${school.slug}`}
          onClick={(e) => {
            e.preventDefault()
            onJump(school.slug)
          }}
          data-ws-theme="platform"
          aria-label={`${school.name} · ${count === 0 ? "programs coming soon" : plural(count, "program")}`}
          className="group relative block aspect-[4/5] overflow-hidden rounded-[12px] bg-ws-sunken text-ws-primary outline-none sm:rounded-[16px]"
        >
          <motion.span
            className="absolute inset-0 block"
            initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            transition={ok ? { duration: 1.05, ease: EASE_INERTIA, delay } : { duration: 0 }}
          >
            {school.cover ? (
              <motion.span
                className="absolute inset-0 block"
                initial={{ scale: 1.18 }}
                animate={{ scale: 1 }}
                transition={ok ? { duration: 1.5, ease: EASE_INERTIA, delay } : { duration: 0 }}
              >
                <Image
                  src={school.cover}
                  alt=""
                  fill
                  priority={index < 4}
                  sizes="(min-width: 1280px) 170px, (min-width: 1024px) 14vw, 25vw"
                  className={cn(
                    FOCUS,
                    "object-cover transition-transform duration-600 ease-[var(--ws-ease-rise)] motion-safe:group-hover:scale-[1.05]"
                  )}
                />
              </motion.span>
            ) : (
              <span className="flex h-full items-center justify-center text-ws-muted">
                <SchoolIcon name={icon} size={28} />
              </span>
            )}
            {/* The name's ground: the render's own floor, deepened. */}
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-ws-page/85 via-ws-page/10 to-transparent transition-opacity duration-600 ease-[var(--ws-ease-rise)] group-hover:opacity-70"
            />
            <span
              aria-hidden
              className="absolute left-2 top-1.5 font-display text-[13px] font-light tabular-nums tracking-[-0.01em] text-ws-primary/90 sm:left-3.5 sm:top-3 sm:text-[15px]"
            >
              {school.number}
            </span>
            <span
              aria-hidden
              className="absolute inset-x-3.5 bottom-3 hidden text-[12.5px] font-semibold leading-[1.25] text-ws-primary sm:line-clamp-3 lg:hidden xl:line-clamp-3"
            >
              {school.short}
            </span>
          </motion.span>
          {/* Focus ring — its own top layer, above the clipped art. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 ring-2 ring-inset ring-ws-brand group-focus-visible:opacity-100"
          />
        </a>
      </motion.div>
    </li>
  )
}
