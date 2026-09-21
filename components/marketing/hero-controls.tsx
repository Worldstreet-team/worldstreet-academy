"use client"

import * as React from "react"
import { PauseIcon, PlayIcon } from "lucide-react"
import { SLIDE_MS } from "@/components/marketing/hero-stage"
import { cn } from "@/lib/utils"

/**
 * The slideshow's clock: calls `onDone` once the current slide has been on
 * stage for SLIDE_MS of RUNNING time. Holding (`running` false) keeps what
 * is left, so a hover or a hidden tab resumes where it stopped; a new slide
 * (`slide`) starts a fresh dwell.
 */
export function useSlideClock(slide: number, running: boolean, onDone: () => void) {
  const left = React.useRef(SLIDE_MS)
  const done = React.useRef(onDone)
  React.useEffect(() => {
    done.current = onDone
  })
  // Cleanups run before bodies, so a slide change banks the old dwell first
  // and this reset wins.
  React.useEffect(() => {
    left.current = SLIDE_MS
  }, [slide])
  React.useEffect(() => {
    if (!running) return
    const start = performance.now()
    const t = window.setTimeout(() => {
      left.current = SLIDE_MS
      done.current()
    }, Math.max(0, left.current))
    return () => {
      window.clearTimeout(t)
      left.current -= performance.now() - start
    }
  }, [slide, running])
}

/**
 * The slideshow's pause/play (WCAG 2.2.2), without a visible control row
 * (owner, 2026-09-18: "not necessary"). It is the hero's first stop in the
 * tab order and in reading order, clipped out of sight until it takes
 * keyboard focus, when it appears as a pill in the stage's top-right corner.
 * Absolutely placed in both states, so it never takes or reserves space.
 * Under reduced motion nothing plays, and it is not rendered.
 */
export function HeroPauseToggle({ paused, onToggle }: { paused: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "absolute right-3 top-3 z-10 inline-flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-ws-raised px-3.5 text-[13px] font-medium text-ws-primary ring-1 ring-inset ring-ws-primary/15",
        "[clip-path:inset(50%)] focus-visible:[clip-path:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/60"
      )}
    >
      {paused ? <PlayIcon size={14} aria-hidden /> : <PauseIcon size={14} aria-hidden />}
      {paused ? "Play background slideshow" : "Pause background slideshow"}
    </button>
  )
}
