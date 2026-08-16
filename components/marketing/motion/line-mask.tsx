"use client"

import * as React from "react"
import { motion, useInView } from "motion/react"
import { cn } from "@/lib/utils"
import { EASE_INERTIA } from "./ease"
import { useMotionOK } from "./bus"

const WRAPPERS = {
  h1: "h1",
  h2: "h2",
  p: "p",
  div: "div",
} as const

export type LineMaskLine = { text: string; className?: string }

/**
 * Masked line reveal: each line is an `overflow-hidden` block whose inner
 * span rises from `y: 110%` over 0.9s EASE_INERTIA, 90ms line stagger.
 * `mode="mount"` for the hero (the page's one load sequence), `mode="inview"`
 * for scroll-triggered headings. Reduced motion: plain fade.
 *
 * The inview trigger observes the OUTER wrapper, never the masked spans:
 * a span parked at y:110% is fully clipped by its own overflow-hidden line
 * box, and IntersectionObserver clips by ancestor overflow — so a
 * `whileInView` on the span itself reports 0% visible forever and never
 * fires (the bug that blanked the old finale heading). The wrapper keeps its
 * layout box regardless of the span's transform, so it can always intersect.
 */
export function LineMask({
  lines,
  as = "h1",
  mode = "mount",
  delay = 0,
  className,
}: {
  lines: LineMaskLine[]
  as?: keyof typeof WRAPPERS
  mode?: "mount" | "inview"
  delay?: number
  className?: string
}) {
  const ok = useMotionOK()
  const Tag = WRAPPERS[as] as React.ElementType
  const ref = React.useRef<HTMLElement>(null)
  // Low amount + once: a tall display heading can never put most of itself
  // on screen at the same time, so a large threshold would dead-end.
  const inView = useInView(ref, { once: true, amount: 0.2 })
  const play = mode === "mount" || inView

  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, i) => {
        const transition = ok
          ? { duration: 0.9, ease: EASE_INERTIA, delay: delay + i * 0.09 }
          : { duration: 0.3, delay: 0 }
        const initial = ok ? { y: "110%", opacity: 1 } : { y: "0%", opacity: 0 }
        return (
          <span key={i} className="block overflow-hidden">
            <motion.span
              className={cn("block", line.className)}
              initial={initial}
              animate={play ? { y: "0%", opacity: 1 } : initial}
              transition={transition}
            >
              {line.text}
            </motion.span>
          </span>
        )
      })}
    </Tag>
  )
}
