"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { MarketingCourseCard } from "@/components/marketing/course-card"
import { DragRail } from "@/components/marketing/motion/drag-rail"
import { Reveal, RevealGroup } from "@/components/marketing/motion/reveal"
import { SlicedReveal } from "@/components/marketing/motion/sliced-reveal"
import { addFrame, useMediaQuery, useMotionOK } from "@/components/marketing/motion/bus"
import type { BrowseCourse } from "@/lib/actions/student"

/**
 * §5 — THE CATALOGUE. Edge-bleeding draggable rail of real course cards.
 * First 5 cards enter via SlicedReveal (90ms stagger), the rest plain
 * fade-up. Desktop polish: each thumbnail micro-parallaxes ±6% inside its
 * clipped crop by viewport position, recomputed on scroll activity through
 * the shared rAF bus.
 */
export function CatalogueRail({
  courses,
  signedIn,
}: {
  courses: BrowseCourse[]
  signedIn: boolean
}) {
  const ok = useMotionOK()
  const isMobile = useMediaQuery("(max-width: 767px)")
  const coarse = useMediaQuery("(pointer: coarse)")
  const [hintGone, setHintGone] = React.useState(false)

  // ── Thumbnail micro-parallax (desktop, motion-OK) ──
  const imageRefs = React.useRef(new Map<string, HTMLDivElement>())
  const parallaxState = React.useRef({
    dirty: false,
    unsub: null as null | (() => void),
  })

  const markDirty = React.useCallback(() => {
    if (!ok || isMobile || coarse) return
    const s = parallaxState.current
    s.dirty = true
    if (s.unsub) return
    s.unsub = addFrame(() => {
      const st = parallaxState.current
      if (!st.dirty) {
        st.unsub = null
        return false
      }
      st.dirty = false
      const vw = window.innerWidth
      for (const el of imageRefs.current.values()) {
        const rect = el.getBoundingClientRect()
        if (rect.right < -100 || rect.left > vw + 100) continue
        const centered = (rect.left + rect.width / 2) / vw - 0.5 // −0.5..0.5
        const tx = Math.max(-6, Math.min(6, centered * -12))
        el.style.transform = `translate3d(${tx.toFixed(2)}%, 0, 0)`
      }
      return true
    })
  }, [ok, isMobile, coarse])

  React.useEffect(() => {
    if (!ok || isMobile || coarse) return
    const onScroll = () => markDirty()
    window.addEventListener("scroll", onScroll, { passive: true })
    markDirty()
    const s = parallaxState.current
    return () => {
      window.removeEventListener("scroll", onScroll)
      s.unsub?.()
      s.unsub = null
    }
  }, [ok, isMobile, coarse, markDirty])

  if (courses.length < 3) return null

  return (
    <section className="relative isolate py-28">
      {/* Header row */}
      <div className="mx-auto flex max-w-7xl items-end justify-between gap-6 px-6 pb-10">
        <RevealGroup>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ws-gold">
            The catalogue
          </p>
          <h2
            className="mt-4 font-display font-semibold leading-[1.05] tracking-[-0.02em] text-ws-primary"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            Browse it all before you sign up.
          </h2>
        </RevealGroup>
        <Reveal delay={0.15} className="hidden shrink-0 sm:block">
          <Link
            href="/courses"
            className="text-[14px] font-semibold text-ws-gold transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-80"
          >
            View all →
          </Link>
        </Reveal>
      </div>

      {/* The rail — first card aligned to the grid, right edge bleeding off. */}
      <DragRail
        onFirstDrag={() => setHintGone(true)}
        onScrollActivity={markDirty}
        className="w-full"
      >
        <div className="flex w-max items-stretch gap-5 pr-6 [padding-left:max(1.5rem,calc((100vw-80rem)/2+1.5rem))]">
          {courses.map((course, i) =>
            i < 5 ? (
              <SlicedReveal
                key={course.id}
                delay={i * 0.09}
                className="shrink-0 rounded-lg [scroll-snap-align:start]"
              >
                <MarketingCourseCard
                  course={course}
                  signedIn={signedIn}
                  imageParallaxRef={(el) => {
                    if (el) imageRefs.current.set(course.id, el)
                    else imageRefs.current.delete(course.id)
                  }}
                />
              </SlicedReveal>
            ) : (
              <Reveal
                key={course.id}
                y={28}
                duration={0.65}
                className="shrink-0 [scroll-snap-align:start]"
              >
                <MarketingCourseCard
                  course={course}
                  signedIn={signedIn}
                  imageParallaxRef={(el) => {
                    if (el) imageRefs.current.set(course.id, el)
                    else imageRefs.current.delete(course.id)
                  }}
                />
              </Reveal>
            )
          )}
        </div>
      </DragRail>

      {/* Drag hint — desktop only, fades out after the first drag. */}
      {ok && !coarse && (
        <div className="mx-auto max-w-7xl px-6 pt-4 text-right">
          <AnimatePresence>
            {!hintGone && (
              <motion.span
                className="text-[11px] uppercase tracking-[0.14em] text-ws-subtle"
                exit={{ opacity: 0, transition: { duration: 0.3 } }}
              >
                — drag
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Mobile link */}
      <div className="px-6 pt-6 text-center sm:hidden">
        <Link href="/courses" className="text-[14px] font-semibold text-ws-gold">
          View all →
        </Link>
      </div>
    </section>
  )
}
