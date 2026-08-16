"use client"

import * as React from "react"
import { addFrame, useMotionOK } from "@/components/marketing/motion/bus"

/** What the academy actually trades in. Words, not claims. */
const WORDS = [
  "Curriculum",
  "Discipline",
  "Risk",
  "Structure",
  "Mentorship",
  "Practice",
  "Execution",
  "Certification",
  "Patience",
  "Conviction",
] as const

/** px per second at full tilt. */
const SPEED = 46

/**
 * A single band of academic vocabulary drifting across the page.
 *
 * No background — the words sit straight on the stage, and the CONTAINER's
 * left and right edges are masked to transparent so the band appears to come
 * out of nothing and dissolve back into it (a mask, not an entrance
 * animation).
 *
 * Travel direction follows the reader: scrolling down pushes the words left,
 * scrolling up pulls them back right. Position is integrated as a signed
 * delta and wrapped modulo one copy, so a reversal is seamless rather than a
 * jump — which is exactly what flipping a fixed `direction` flag would cause.
 */
export function WordsMarquee() {
  const ok = useMotionOK()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const posRef = React.useRef(0)
  const dirRef = React.useRef(-1) // -1 → drifts left (the resting direction)
  const [copies, setCopies] = React.useState(3)

  // Scroll direction, with a small deadzone so jitter can't flip the band.
  React.useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) > 2) {
        dirRef.current = y > last ? -1 : 1
        last = y
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Enough copies to cover the viewport plus one wrap period.
  React.useEffect(() => {
    const measure = () => {
      const container = containerRef.current
      const copy = trackRef.current?.children[0] as HTMLElement | undefined
      if (!container?.offsetWidth || !copy?.offsetWidth) return
      setCopies(Math.max(3, Math.ceil(container.offsetWidth / copy.offsetWidth) + 2))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  React.useEffect(() => {
    if (!ok) return
    return addFrame((dt) => {
      const track = trackRef.current
      const copy = track?.children[0] as HTMLElement | undefined
      if (!track || !copy?.offsetWidth) return true
      const period = copy.offsetWidth
      const next = posRef.current + (dirRef.current * SPEED * dt) / 1000
      // Positive modulo keeps the offset inside one period in both directions.
      posRef.current = ((next % period) + period) % period
      track.style.transform = `translate3d(${-posRef.current}px, 0, 0)`
      return true
    })
  }, [ok])

  const row = (
    <div className="flex shrink-0 items-center">
      {WORDS.map((word) => (
        <span key={word} className="flex items-center">
          <span className="whitespace-nowrap px-6 font-display text-2xl font-semibold tracking-[-0.01em] text-ws-subtle md:px-9 md:text-4xl">
            {word}
          </span>
          <span aria-hidden className="size-1 shrink-0 rounded-full bg-ws-brand/50" />
        </span>
      ))}
    </div>
  )

  return (
    <section aria-label="What the academy teaches" className="py-14 md:py-20">
      <div
        ref={containerRef}
        className="overflow-hidden"
        style={{
          // The faded container edges — words emerge from and dissolve into
          // the page rather than being clipped at a hard boundary.
          maskImage:
            "linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%)",
        }}
      >
        <div ref={trackRef} className="flex w-max will-change-transform">
          {Array.from({ length: copies }, (_, i) => (
            <React.Fragment key={i}>
              {i === 0 ? row : <div aria-hidden>{row}</div>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
