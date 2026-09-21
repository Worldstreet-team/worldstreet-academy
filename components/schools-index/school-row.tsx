"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { motion, useInView, useScroll, useTransform } from "motion/react"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { SchoolIcon } from "@/components/shared/school-icon"
import { SCHOOL_BY_SLUG } from "@/lib/schools"
import { cn } from "@/lib/utils"
import { Highlight } from "./highlight"
import { LEVEL_LABEL, RENDER_THUMB, isRender, plural, usd, type IndexProgram, type SchoolHit } from "./model"

const OPEN = "inset(0% 0% 0% 0% round 20px)"

/**
 * One school on `/schools`: its cover large, its number, its name and line,
 * and its actual programs as direct links (title, level, packages, price →
 * `/programs/<slug>`), then the way into the school itself. Rows alternate
 * sides from lg so eight equal schools read as a sequence of spreads rather
 * than a grid of tiles; below lg the cover sits on top.
 *
 * Motion, once per row: the cover unveils from its outer edge (a clip-path
 * wipe) as it arrives, the render settling from a slight zoom; while the row
 * crosses the viewport the render drifts inside its frame. Reduced motion:
 * the cover is simply there.
 *
 * `hidden` keeps a filtered-out row mounted, so a row that has already
 * unveiled never replays it while the visitor types.
 */
export function SchoolRow({
  hit,
  flip,
  tokens,
  hidden,
}: {
  hit: SchoolHit
  /** Cover on the right (lg+). */
  flip: boolean
  tokens: readonly string[]
  hidden: boolean
}) {
  const { school, programs, hidden: more } = hit
  const ok = useMotionOK()
  const coverRef = React.useRef<HTMLAnchorElement>(null)
  const inView = useInView(coverRef, { once: true, amount: 0.08 })
  const { scrollYProgress } = useScroll({ target: coverRef, offset: ["start end", "end start"] })
  const drift = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"])
  const shown = !ok || inView
  const total = school.programs.length
  const icon = SCHOOL_BY_SLUG[school.slug].icon

  return (
    <article
      id={school.slug}
      data-school-row={school.slug}
      aria-labelledby={`${school.slug}-title`}
      hidden={hidden}
      className="grid scroll-mt-24 gap-7 md:scroll-mt-40 lg:grid-cols-12 lg:items-center lg:gap-x-14"
    >
      {/* The cover — a second way into the school for the pointer; the
          "Explore school" link below is the one keyboard and reader stop. */}
      <Link
        ref={coverRef}
        href={`/schools/${school.slug}`}
        tabIndex={-1}
        aria-hidden
        data-ws-theme="platform"
        className={cn(
          "group relative block aspect-[16/10] text-ws-primary lg:col-span-7",
          flip && "lg:order-2"
        )}
      >
        <motion.span
          className="absolute inset-0 block overflow-hidden rounded-[20px] bg-ws-sunken"
          // `initial` never changes after mount: flipping it to `false` once the
          // reduced-motion preference lands would block motion's first animate
          // and leave the cover clipped. Reduced motion opens it instantly instead.
          initial={{ clipPath: flip ? "inset(0% 0% 0% 100% round 20px)" : "inset(0% 100% 0% 0% round 20px)" }}
          animate={shown ? { clipPath: OPEN } : undefined}
          transition={ok ? { duration: 1.1, ease: EASE_INERTIA } : { duration: 0 }}
        >
          {school.cover ? (
            <motion.span
              className="absolute inset-x-0 -inset-y-[7%] block"
              style={ok ? { y: drift } : undefined}
            >
              <motion.span
                className="absolute inset-0 block"
                initial={{ scale: 1.14 }}
                animate={shown ? { scale: 1 } : undefined}
                transition={ok ? { duration: 1.5, ease: EASE_INERTIA } : { duration: 0 }}
              >
                <Image
                  src={school.cover}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 700px, (min-width: 1024px) 56vw, 100vw"
                  className="object-cover transition-transform duration-600 ease-[var(--ws-ease-rise)] motion-safe:group-hover:scale-[1.03]"
                />
              </motion.span>
            </motion.span>
          ) : (
            <span className="flex h-full items-center justify-center text-ws-muted">
              <SchoolIcon name={icon} size={56} />
            </span>
          )}
          {/* The number's ground: the render's empty left side, deepened a touch. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--ws-bg-page)_55%,transparent)_0%,transparent_45%)]"
          />
          <span
            aria-hidden
            className="absolute left-5 top-4 font-display text-[clamp(3rem,7vw,5.75rem)] font-extralight leading-none tracking-[-0.05em] tabular-nums text-ws-primary/90 md:left-8 md:top-6"
          >
            {school.number}
          </span>
        </motion.span>
      </Link>

      <div className={cn("min-w-0 max-w-2xl lg:col-span-5 lg:max-w-none", flip && "lg:order-1")}>
        <h2 id={`${school.slug}-title`} className="font-display">
          {school.lead && (
            <span className="block text-[16px] font-light leading-none text-ws-muted md:text-[17px]">
              {school.lead}
            </span>
          )}{" "}
          <span className="mt-2.5 block text-balance text-[clamp(1.75rem,2.7vw,2.5rem)] font-semibold leading-[1.06] tracking-[-0.022em] text-ws-primary">
            <Highlight text={school.title} tokens={tokens} />
          </span>
        </h2>
        {school.tagline && (
          <p className="mt-5 text-pretty font-display text-[17px] font-medium leading-snug text-ws-primary md:text-[18px]">
            {school.tagline}
          </p>
        )}
        <p className={cn("text-pretty text-[15px] leading-relaxed text-ws-muted md:text-[16px]", school.tagline ? "mt-2.5" : "mt-4")}>
          {school.blurb}
        </p>

        <div className="mt-8">
          <p className="text-[13px] tabular-nums text-ws-muted">
            {total === 0 ? (
              "Programs coming soon"
            ) : (
              <>
                {plural(total, "program")}
                {school.from !== null && (
                  <>
                    {" · "}
                    {school.from === 0 ? (
                      <span className="font-semibold text-ws-primary">Free</span>
                    ) : (
                      <>
                        from <span className="font-semibold text-ws-primary">{usd(school.from)}</span>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </p>

          {total === 0 ? (
            <div className="mt-3 rounded-[20px] border border-ws-hairline bg-ws-surface px-5 py-5 dark:border-transparent">
              <p className="font-display text-[15.5px] font-semibold text-ws-primary">
                No program is open in this school yet
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ws-muted">
                Explore the school to see what it covers.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-ws-hairline overflow-hidden rounded-[20px] border border-ws-hairline bg-ws-surface dark:border-transparent">
              {programs.map((program) => (
                <li key={program.id}>
                  <ProgramLink program={program} tokens={tokens} />
                </li>
              ))}
              {more > 0 && (
                <li>
                  <Link
                    href={`/schools/${school.slug}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary focus-visible:bg-ws-raised focus-visible:outline-none"
                  >
                    {plural(more, "more program")} in this school
                    <ArrowRightIcon size={14} aria-hidden className="shrink-0" />
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>

        <Link
          href={`/schools/${school.slug}`}
          className="group mt-7 inline-flex items-center gap-3 rounded-full text-[14.5px] font-semibold text-ws-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-4 focus-visible:ring-offset-ws-page"
        >
          Explore school
          <span className="sr-only">: {school.name}</span>
          <span className="flex size-10 items-center justify-center rounded-full bg-ws-primary/[0.08] ring-1 ring-ws-primary/10 transition-colors duration-[var(--ws-motion-base)] group-hover:bg-ws-primary/[0.16]">
            <ArrowRightIcon
              size={16}
              aria-hidden
              className="transition-transform duration-200 ease-[var(--ws-ease)] group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      </div>
    </article>
  )
}

/** A program as one row: its art, title, and what it costs to start — the whole row opens the program. */
export function ProgramLink({ program, tokens }: { program: IndexProgram; tokens: readonly string[] }) {
  return (
    <Link
      href={`/programs/${program.slug}`}
      className="group/p flex items-center gap-3 px-4 py-3.5 transition-colors sm:gap-4 duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:bg-ws-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40"
    >
      <span className="relative aspect-[16/10] w-16 shrink-0 overflow-hidden rounded-[9px] bg-ws-sunken sm:w-[4.5rem]">
        {program.art && (
          <Image
            src={program.art}
            alt=""
            fill
            sizes={isRender(program.art) ? "144px" : "72px"}
            className={cn("object-cover", isRender(program.art) && RENDER_THUMB)}
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15.5px] font-semibold leading-snug text-ws-primary">
          <Highlight text={program.title} tokens={tokens} />
        </span>
        <span className="mt-0.5 block text-[13px] text-ws-muted">
          {[LEVEL_LABEL[program.level], program.packages >= 2 ? plural(program.packages, "package") : null, program.opens]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {program.price !== null && (
        <span className="shrink-0 text-right tabular-nums leading-tight">
          {program.packages >= 2 && program.price > 0 && (
            <span className="block text-[11.5px] text-ws-muted">from</span>
          )}
          <span className="block text-[15px] font-semibold text-ws-primary">
            {program.price === 0 ? "Free" : usd(program.price)}
          </span>
        </span>
      )}
      <ArrowRightIcon
        size={16}
        aria-hidden
        className="-ml-1 shrink-0 text-ws-muted transition-[transform,color] duration-200 ease-[var(--ws-ease)] group-hover/p:translate-x-0.5 group-hover/p:text-ws-primary"
      />
    </Link>
  )
}
