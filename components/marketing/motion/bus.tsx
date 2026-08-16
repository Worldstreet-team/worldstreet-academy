"use client"

import * as React from "react"
import { useReducedMotion } from "motion/react"

/**
 * Shared rAF bus — one module-level loop shared by DragRail inertia, the hero
 * pointer drift, TiltCard, catalogue micro-parallax and the reviews marquee.
 *
 * Subscribers are `(dt: ms) => boolean` callbacks: return `true` to stay on
 * the loop, `false` when settled (epsilon reached, offscreen, unmounting).
 * The loop self-suspends the moment the subscriber set empties, so an idle
 * landing page schedules zero frames.
 */
type FrameFn = (dt: number) => boolean

const subs = new Set<FrameFn>()
let rafId: number | null = null
let last = 0

function tick(now: number) {
  // Clamp dt so a background-tab wakeup doesn't fling inertial values.
  const dt = Math.min(now - last, 64)
  last = now
  for (const fn of Array.from(subs)) {
    let keep = false
    try {
      keep = fn(dt)
    } catch {
      keep = false
    }
    if (!keep) subs.delete(fn)
  }
  rafId = subs.size > 0 ? requestAnimationFrame(tick) : null
}

/** Register a frame callback. Returns an unsubscribe function. */
export function addFrame(fn: FrameFn): () => void {
  if (typeof window === "undefined") return () => {}
  subs.add(fn)
  if (rafId === null) {
    last = performance.now()
    rafId = requestAnimationFrame(tick)
  }
  return () => {
    subs.delete(fn)
  }
}

/**
 * Frame-rate-independent lerp step:
 * `pos + (target − pos) * (1 − (1 − F)^(dt/16.67))`
 * F = 0.12 rail settle · 0.06 pointer drift · 0.08 tilt.
 */
export function lerpStep(pos: number, target: number, F: number, dt: number): number {
  return pos + (target - pos) * (1 - Math.pow(1 - F, dt / 16.67))
}

/** Epsilon below which inertial subscribers should drop off the loop. */
export const SETTLE_EPSILON = 0.05

/**
 * Reduced-motion master switch. motion v12's useReducedMotion reports the
 * REAL preference on the first client render, but the server always rendered
 * the motion-OK tree — so returning it directly hydration-mismatches for
 * reduced-motion users. Two-pass: first client render matches SSR (ok), the
 * real preference lands in the post-hydration render.
 */
export function useMotionOK(): boolean {
  const reduced = useReducedMotion()
  const [hydrated, setHydrated] = React.useState(false)
  React.useEffect(() => setHydrated(true), [])
  return hydrated ? !reduced : true
}

/** Post-hydration media query (SSR-safe: always `false` on the server pass). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [query])
  return matches
}
