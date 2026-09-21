"use client"

import { motion, useScroll, useSpring } from "motion/react"
import { useMotionOK } from "./bus"

/**
 * The landing's reading progress: a 2px gold line laid over the navbar's
 * hairline foot, filling left to right with the page's scroll. Gold because
 * it is an active state — where you are — not decoration.
 *
 * The bar is sticky and opaque with a 1px border (57px tall on phones, 65px
 * from sm), so the line sits at 55px / 63px and covers the bar's last two
 * pixels: it reads as the hairline itself lighting up, never as a second
 * rule floating over the page. z-50 and later in the DOM than the header, so
 * it paints over it; sheets and popovers (z-80) still cover it.
 *
 * A light spring takes the wheel's steps out of it. Reduced motion: the line
 * still reports position, just without the spring. Server render and first
 * client render are both scaleX(0).
 */
export function ScrollProgress() {
  const ok = useMotionOK()
  const { scrollYProgress } = useScroll()
  const eased = useSpring(scrollYProgress, { stiffness: 240, damping: 36, mass: 0.35, restDelta: 0.0005 })

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-[55px] z-50 h-0.5 origin-left bg-ws-brand will-change-transform sm:top-[63px]"
      style={{ scaleX: ok ? eased : scrollYProgress }}
    />
  )
}
