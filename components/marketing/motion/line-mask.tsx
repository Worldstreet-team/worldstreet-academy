"use client"

import * as React from "react"
import { motion } from "motion/react"
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
 * for the finale (once). Reduced motion: plain fade.
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
  const Tag = WRAPPERS[as]

  const target = { y: "0%", opacity: 1 }

  return (
    <Tag className={className}>
      {lines.map((line, i) => {
        const transition = ok
          ? { duration: 0.9, ease: EASE_INERTIA, delay: delay + i * 0.09 }
          : { duration: 0.3, delay: 0 }
        const initial = ok ? { y: "110%", opacity: 1 } : { y: "0%", opacity: 0 }
        return (
          <span key={i} className="block overflow-hidden">
            {mode === "mount" ? (
              <motion.span
                className={cn("block", line.className)}
                initial={initial}
                animate={target}
                transition={transition}
              >
                {line.text}
              </motion.span>
            ) : (
              <motion.span
                className={cn("block", line.className)}
                initial={initial}
                whileInView={target}
                // 0.25, not 0.6: a tall heading in a tall section can never
                // put 60% of itself on screen at once, and the line would
                // stay clipped at y:110% — a blank gap where a headline
                // should be.
                viewport={{ once: true, amount: 0.25 }}
                transition={transition}
              >
                {line.text}
              </motion.span>
            )}
          </span>
        )
      })}
    </Tag>
  )
}
