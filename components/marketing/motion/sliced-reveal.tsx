"use client"

import * as React from "react"
import { motion, useInView } from "motion/react"
import { cn } from "@/lib/utils"
import { EASE_LUX } from "./ease"
import { useMotionOK } from "./bus"

const BARS = 5

/**
 * Sliced-columns reveal (the camera.js `slicedCols` character, rebuilt on
 * live DOM): 5 vertical `bg-ws-page` bars cover the content, then each
 * translates fully off (550ms `--ws-ease-rise`, 70ms per-bar stagger) while
 * the content underneath rises 8px. Bars are page-toned, so before the peel
 * the card simply reads as a solid block of page.
 *
 * Fires once at real visibility (amount 0.35, −15% margin) — or, when `play`
 * is provided, under caller control (the pinned exam sequence drives panel 3
 * from scroll progress instead of an IO). Once played it stays revealed.
 * Reduced motion: bars skipped, plain 300ms fade.
 */
export function SlicedReveal({
  children,
  className,
  play,
  delay = 0,
}: {
  children?: React.ReactNode
  className?: string
  /** Controlled trigger. Omit for automatic in-view triggering. */
  play?: boolean
  delay?: number
}) {
  const ok = useMotionOK()
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35, margin: "-15% 0px" })
  const latched = React.useRef(false)
  if (play) latched.current = true
  const on = play !== undefined ? play || latched.current : inView

  if (!ok) {
    return (
      <motion.div
        ref={ref}
        className={className}
        initial={{ opacity: 0 }}
        animate={on ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      {/* Content rises 8px while the bars peel. */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, y: 8 }}
        animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.55, ease: EASE_LUX, delay: delay + 0.08 }}
      >
        {children}
      </motion.div>
      {/* The cover bars — above the content, clipped by the wrapper. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20 flex">
        {Array.from({ length: BARS }, (_, i) => (
          <motion.span
            key={i}
            className="h-full flex-1 origin-top bg-ws-page will-change-transform"
            // 1px overlap kills sub-pixel seams between adjacent bars.
            style={{ marginLeft: i ? -1 : 0, paddingLeft: i ? 1 : 0 }}
            initial={{ scaleY: 1 }}
            animate={on ? { scaleY: 0 } : { scaleY: 1 }}
            transition={{ duration: 0.55, ease: EASE_LUX, delay: delay + i * 0.07 }}
          />
        ))}
      </div>
    </div>
  )
}
