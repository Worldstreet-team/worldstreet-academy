"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import type { BrowseCourse } from "@/lib/actions/student"
import { LineMask } from "@/components/marketing/motion/line-mask"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { addFrame, useMotionOK } from "@/components/marketing/motion/bus"
import { BRAND } from "@/lib/brand"
import { SCHOOLS, cheapestBySchool, countProgramsBySchool } from "@/lib/schools"
import { schoolCover } from "@/lib/school-art"
import { useStartSchool } from "@/components/marketing/start-school-store"
import { cn } from "@/lib/utils"

/** Row drift speeds, px/s — alternating directions, deliberately unequal so
 *  the five rows never phase-lock into a visible grid. */
const ROW_SPEEDS = [-14, 11, -19, 15, -9]

/**
 * §1 — HERO, Netflix-style. A wall of course art drifts behind the headline:
 * three rows sliding in opposite directions, dimmed under a stone overlay
 * that fades to transparency, with the hero text and CTAs on top. The wall is
 * pure scenery — aria-hidden, pointer-events-none, no links, no hearts.
 *
 * Drift runs on the shared rAF bus with modulo wrap (same math as the words
 * marquee), so it is continuous, frame-rate independent, and reverses nothing
 * on scroll. Reduced motion: the wall stands still.
 *
 * Below the claim the hero asks one question — what do you want to master? —
 * and the eight schools answer as chips. Choosing one crossfades that
 * school's cover in behind the copy, states what it costs, and points the
 * gold CTA at `/dashboard/start?school=…` (owner, 2026-09-16: the school is
 * chosen on the landing, before the dashboard). From lg up the cover rises
 * ABOVE the overlay, masked to emerge from the page colour, and the student
 * steps aside for it — every cover's object sits where she stands. Narrower
 * screens keep it behind the veil. One-shot on the tap, instant under
 * reduced motion.
 */
export function HeroWall({
  courses,
  signedIn,
  registerUrl,
}: {
  courses: BrowseCourse[]
  signedIn: boolean
  registerUrl: string
}) {
  const ok = useMotionOK()
  const rowRefs = React.useRef<Array<HTMLDivElement | null>>([])
  const positions = React.useRef<number[]>(ROW_SPEEDS.map(() => 0))

  const picked = useStartSchool((s) => s.picked)
  const pick = useStartSchool((s) => s.pick)
  const counts = React.useMemo(() => countProgramsBySchool(courses), [courses])
  const cheapest = React.useMemo(() => cheapestBySchool(courses), [courses])
  const pickedSchool = picked ? SCHOOLS.find((s) => s.slug === picked)! : null
  const pickedCover = schoolCover(picked)

  const art = courses.filter((c) => c.thumbnailUrl).map((c) => c.thumbnailUrl!)
  // Three rows, each cycled to at least 8 tiles, offset so seams never align.
  const rows =
    art.length > 0
      ? ROW_SPEEDS.map((_, r) =>
          Array.from({ length: Math.max(10, art.length) }, (_, i) => art[(i + r * 3) % art.length]),
        )
      : []

  React.useEffect(() => {
    if (!ok || rows.length === 0) return
    return addFrame((dt) => {
      ROW_SPEEDS.forEach((speed, r) => {
        const track = rowRefs.current[r]
        const copy = track?.children[0] as HTMLElement | undefined
        if (!track || !copy?.offsetWidth) return
        const period = copy.offsetWidth
        const next = positions.current[r] + (speed * dt) / 1000
        positions.current[r] = ((next % period) + period) % period
        track.style.transform = `translate3d(${-positions.current[r]}px, 0, 0)`
      })
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, rows.length])

  return (
    <section
      id="hero"
      className="relative isolate -mt-[4.25rem] flex min-h-[92svh] items-center overflow-hidden sm:-mt-[5.25rem]"
      aria-label={BRAND.name}
    >
      {/* ── The wall ── */}
      {rows.length > 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 select-none overflow-hidden">
          {/* Oversized and rotated: the slant would otherwise expose bare
              corners, so the field extends well past every edge. */}
          <div className="absolute inset-[-22%] flex flex-col justify-center gap-2 rotate-[-8deg] sm:gap-2.5 md:gap-3">
            {rows.map((tiles, r) => (
              <div key={r} className="overflow-hidden" style={{ marginLeft: r % 2 ? "-7rem" : "-2.5rem" }}>
                <div
                  ref={(el) => {
                    rowRefs.current[r] = el
                  }}
                  className="flex w-max will-change-transform"
                >
                  {[0, 1].map((copy) => (
                    <div key={copy} className="flex shrink-0 gap-2 pr-2 sm:gap-2.5 sm:pr-2.5 md:gap-3 md:pr-3">
                      {tiles.map((src, i) => (
                        <div
                          key={`${copy}-${i}`}
                          className="relative aspect-[4/3] w-[11rem] shrink-0 overflow-hidden rounded-md sm:aspect-video sm:w-[14rem] md:w-[19rem] lg:w-[23rem]"
                        >
                          <Image
                            src={src}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 11rem, (max-width: 768px) 14rem, (max-width: 1024px) 19rem, 23rem"
                            draggable={false}
                            className="object-cover opacity-70"
                            priority={r === 1 && copy === 0 && i < 3}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── The chosen school's cover: a crossfade on the visitor's tap, not ambient motion ──
          Below lg: under the overlay (-z-[15]), dimmed like the wall — the
          copy spans nearly the full width there, so the art stays veiled.
          lg+: above the overlay and just under the student (-z-[7]), at
          near-full strength. Every cover's object sits at ~57–75% of the
          frame, so the frame is pinned left (to the content column's edge
          from xl, where the column centres) to keep the object clear of the
          chips. The wrapper fades the art out under the navbar and into the
          page at the bottom; the frame's own mask lets it emerge from the
          page colour on the left. Dark: a long ramp — the render's shadows
          ARE the page, so light ink reads over them. Light: a short ramp in
          pixels, between the copy and the object (in frame coordinates the
          chips end at 792px from xl and every object starts at ≥840px; at
          lg they end at 696px, objects start at ≥715px), so the dark render
          never runs behind dark ink. */}
      <AnimatePresence>
        {pickedCover && (
          <motion.div
            key={pickedCover}
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-[15] select-none lg:-z-[7] lg:[mask-image:linear-gradient(to_bottom,transparent_6%,black_24%,black_80%,transparent)]"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ok ? 0.32 : 0, ease: EASE_INERTIA }}
          >
            <div className="absolute inset-y-0 left-0 right-0 opacity-40 max-lg:dark:opacity-60 lg:opacity-95 lg:[mask-image:linear-gradient(to_right,transparent_600px,black_720px)] xl:left-[max(0px,calc((100%_-_80rem)/2))] xl:[mask-image:linear-gradient(to_right,transparent_690px,black_840px)] lg:dark:[mask-image:linear-gradient(to_right,transparent_8%,black_50%)]">
              <Image
                src={pickedCover}
                alt=""
                fill
                sizes="100vw"
                draggable={false}
                className="object-cover object-[64%_50%] lg:object-[25%_50%] xl:object-left"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Overlay: dark where the text lives, thinning to transparency ── */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {/* Phones: an even veil, so the wall still reads behind the copy.
            sm+: left-heavy, keeping the text column dark while the right
            side opens to near-transparency. */}
        <div className="absolute inset-0 bg-ws-page/50 sm:bg-gradient-to-r sm:from-ws-page sm:via-ws-page/80 sm:to-ws-page/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-ws-page via-ws-page/55 to-ws-page/40 sm:via-ws-page/35 sm:to-ws-page/60" />
      </div>

      {/* ── The student, bottom-right ──
          Layered above the wall and its overlay (-z-[5] sits between the
          overlay at -z-10 and the copy at z-0) so she reads as a subject in
          front of the scenery, not another tile in it. Anchored to the
          section's bottom edge and cropped by its overflow, so she rises out
          of it. She sits opposite the left-aligned copy, which is why she can
          run large here without fighting the headline: 36rem from xl, 40rem
          from 2xl — measured to clear the longest glyph run by 67px at 1280
          and 111px at 1440. lg stays at 25rem deliberately: at exactly 1024
          the subhead's first line reaches x=598, and a 28rem figure would
          start at 576 and collide. Hidden below md, where no column is free
          of the text. She steps aside (opacity only) while a school's cover
          holds her spot — but only from lg, where the cover is promoted
          above the overlay to replace her; below that the cover stays
          veiled under the overlay, so fading her too would leave the hero
          emptier rather than swapping one subject for another. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 right-0 -z-[5] hidden select-none transition-opacity duration-[var(--ws-motion-slow)] ease-[var(--ws-ease)] motion-reduce:transition-none md:block",
          pickedCover && "lg:opacity-0"
        )}
      >
        <Image
          src="/brand/hero-student.png"
          alt=""
          width={509}
          height={491}
          priority
          className="h-auto w-[20rem] drop-shadow-[0_24px_60px_rgba(0,0,0,0.55)] lg:w-[25rem] xl:w-[36rem] 2xl:w-[40rem]"
        />
      </div>

      {/* ── Hero text ── */}
      <div className="relative mx-auto w-full max-w-7xl px-6 pb-24 pt-36 sm:pt-40 lg:pt-32">
        <motion.p
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {BRAND.name}
        </motion.p>
        <LineMask
          as="h1"
          mode="mount"
          delay={0.05}
          className="mt-5 max-w-4xl font-display text-[clamp(2.75rem,6.5vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ws-primary"
          lines={[
            { text: "Learn Skills." },
            { text: "Build Value." },
            { text: "Own Your Future.", className: "text-ws-gold" },
          ]}
        />
        <motion.p
          className="mt-6 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-lg xl:max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_INERTIA, delay: 0.35 }}
        >
          Master practical, in-demand skills through expert-led programs
          designed for the new and modern economy. Explore our schools,
          choose your path and start building capabilities you can apply in
          the real world.
        </motion.p>
        {/* xl widens the picker to 3xl so the eight chips sit in two rows and
            the CTA clears the fold at 1280×800 — the student's visible edge
            is ~20px beyond it there. lg keeps 2xl: she starts at 624. */}
        <motion.div
          className="mt-7 max-w-2xl xl:max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_INERTIA, delay: 0.5 }}
        >
          <p id="hero-pick" className="text-[14px] font-medium text-ws-primary">
            What do you want to master?
          </p>
          {/* A choice list, not tabs: the chosen chip is raised, never gold —
              gold stays on the one CTA. Phones scroll the row sideways inside
              the gutter; sm+ wraps. */}
          <div
            role="group"
            aria-labelledby="hero-pick"
            className="-mx-6 mt-3 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {SCHOOLS.map((school) => (
              <button
                key={school.slug}
                type="button"
                aria-pressed={picked === school.slug}
                onClick={() => pick(school.slug)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-inset transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
                  picked === school.slug
                    ? "bg-ws-raised text-ws-primary ring-ws-primary/25"
                    : "bg-ws-surface/70 text-ws-muted ring-ws-hairline hover:bg-ws-raised hover:text-ws-primary"
                )}
              >
                {school.short}
              </button>
            ))}
          </div>

          {/* Reserved height (two lines on phones, where it wraps), so
              choosing a school never moves the buttons. */}
          <p
            className="mt-3 min-h-12 text-[14px] leading-6 tabular-nums text-ws-muted sm:min-h-6"
            aria-live="polite"
          >
            {pickedSchool &&
              [
                counts[pickedSchool.slug] === 1 ? "1 program" : `${counts[pickedSchool.slug]} programs`,
                cheapest[pickedSchool.slug] === null
                  ? null
                  : cheapest[pickedSchool.slug] === 0
                    ? "free to start"
                    : `from $${cheapest[pickedSchool.slug]!.toLocaleString("en-US")}`,
                "pay now or save it for later",
              ]
                .filter(Boolean)
                .join(" · ")}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={pickedSchool ? `/dashboard/start?school=${pickedSchool.slug}` : "#schools"}
              className="inline-flex min-h-14 w-full items-center justify-center rounded-sm bg-ws-brand px-6 py-2.5 text-center text-[15px] font-semibold leading-[1.2] text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 sm:min-h-12 sm:w-auto sm:px-8"
            >
              {pickedSchool ? `Start with ${pickedSchool.short}` : "Choose your school"}
            </Link>
            {signedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex h-12 w-full items-center justify-center rounded-sm border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold sm:w-auto"
              >
                Continue learning
              </Link>
            ) : (
              <a
                href={registerUrl}
                className="inline-flex h-12 w-full items-center justify-center rounded-sm border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold sm:w-auto"
              >
                Create an account
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
