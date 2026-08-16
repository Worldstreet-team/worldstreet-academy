"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import type { BrowseCourse } from "@/lib/actions/student"
import { LineMask } from "@/components/marketing/motion/line-mask"
import { EASE_INERTIA } from "@/components/marketing/motion/ease"
import { addFrame, useMotionOK } from "@/components/marketing/motion/bus"

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
      className="relative isolate -mt-[4.25rem] flex min-h-[92svh] items-center overflow-hidden sm:-mt-[5.25rem]"
      aria-label="WorldStreet Academy"
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
          of the text. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 -z-[5] hidden select-none md:block"
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
      <div className="relative mx-auto w-full max-w-7xl px-6 pb-24 pt-36 sm:pt-40">
        <motion.p
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          WorldStreet Academy
        </motion.p>
        <LineMask
          as="h1"
          mode="mount"
          delay={0.05}
          className="mt-5 max-w-4xl font-display text-[clamp(2.75rem,6.5vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ws-primary"
          lines={[
            { text: "A trading floor" },
            { text: "with a syllabus.", className: "text-ws-gold" },
          ]}
        />
        <motion.p
          className="mt-6 max-w-xl text-[15px] leading-relaxed text-ws-muted md:text-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_INERTIA, delay: 0.35 }}
        >
          Courses from traders who trade, live sessions you can speak in, and a
          real exam between the last lesson and your signed certificate.
        </motion.p>
        <motion.div
          className="mt-8 flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_INERTIA, delay: 0.5 }}
        >
          {signedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-8 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
            >
              Continue learning
            </Link>
          ) : (
            <a
              href={registerUrl}
              className="inline-flex h-12 items-center justify-center rounded-sm bg-ws-brand px-8 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
            >
              Start learning
            </a>
          )}
          <Link
            href="/courses"
            className="inline-flex h-12 items-center justify-center rounded-sm border border-ws-hairline px-7 text-[15px] font-semibold text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:border-ws-brand/40 hover:text-ws-gold"
          >
            Explore courses
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
