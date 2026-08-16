"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { addFrame } from "./bus"
import { glide } from "./ease"

/**
 * Opposing-row review marquee mechanics: the track is duplicated 2× for a
 * seamless modulo wrap and driven by the shared rAF bus (translate3d only).
 * Speed ramps 0→full over 600ms EASE_GLIDE on viewport entry; the loop
 * pauses on hover, focus-within, and offscreen (IntersectionObserver) —
 * paused means fully unsubscribed from the bus.
 *
 * The caller decides the reduced-motion / coarse-pointer static-grid
 * fallback; this component assumes motion is OK.
 */
export function Marquee({
  children,
  speed = 28,
  direction = "left",
  className,
}: {
  children?: React.ReactNode
  /** Drift speed in px/s. */
  speed?: number
  direction?: "left" | "right"
  className?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [copies, setCopies] = React.useState(2)
  const state = React.useRef({
    pos: 0,
    ramp: 0,
    visible: false,
    hovered: false,
    focused: false,
    unsub: null as null | (() => void),
  })

  const sync = React.useCallback(() => {
    const s = state.current
    const shouldRun = s.visible && !s.hovered && !s.focused
    if (shouldRun && !s.unsub) {
      s.unsub = addFrame((dt) => {
        const track = trackRef.current
        if (!track) {
          s.unsub = null
          return false
        }
        // Exact wrap period = where the duplicate copy starts (copy + gap).
        const half =
          (track.children[1] as HTMLElement | undefined)?.offsetLeft ??
          track.scrollWidth / 2
        if (half > 0) {
          s.ramp = Math.min(s.ramp + dt, 600)
          const v = speed * glide(s.ramp / 600)
          s.pos = (s.pos + (v * dt) / 1000) % half
          const tx = direction === "left" ? -s.pos : s.pos - half
          track.style.transform = `translate3d(${tx.toFixed(2)}px, 0, 0)`
        }
        const keep = s.visible && !s.hovered && !s.focused
        if (!keep) s.unsub = null
        return keep
      })
    } else if (!shouldRun && s.unsub) {
      s.unsub()
      s.unsub = null
    }
  }, [speed, direction])

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const copy = trackRef.current?.children[0] as HTMLElement | undefined
      if (!el.offsetWidth || !copy?.offsetWidth) return
      setCopies(Math.max(2, Math.ceil((el.offsetWidth * 2) / copy.offsetWidth)))
    }
    measure()
    window.addEventListener("resize", measure)
    const s = state.current
    const io = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = s.visible
        s.visible = entry.isIntersecting
        if (s.visible && !wasVisible) s.ramp = 0 // re-ramp on entry
        sync()
      },
      { threshold: 0 }
    )
    io.observe(el)
    return () => {
      window.removeEventListener("resize", measure)
      io.disconnect()
      s.unsub?.()
      s.unsub = null
    }
  }, [sync])

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden", className)}
      onPointerEnter={() => {
        state.current.hovered = true
        sync()
      }}
      onPointerLeave={() => {
        state.current.hovered = false
        sync()
      }}
      onFocusCapture={() => {
        state.current.focused = true
        sync()
      }}
      onBlurCapture={() => {
        state.current.focused = false
        sync()
      }}
    >
      <div ref={trackRef} className="flex w-max gap-5 will-change-transform">
        {/* Enough copies to cover 2x the container: a single sparse copy
            narrower than the viewport would leave a blank band + wrap snap. */}
        {Array.from({ length: copies }, (_, i) => (
          <div className="flex shrink-0 gap-5" key={i} aria-hidden={i > 0 || undefined}>
            {children}
          </div>
        ))}
      </div>
    </div>
  )
}
