"use client"

import * as React from "react"
import { motion, useScroll, useSpring, useTransform } from "motion/react"
import { useMediaQuery, useMotionOK } from "./bus"

/**
 * Scroll-linked parallax layer. `speed` follows the landing layer vocabulary:
 * A −0.12 · B −0.06 · D +0.16 (negative lags, positive overshoots).
 *
 * The raw offset is `speed × sectionHeight × 0.5`, capped at ±120px, mapped
 * across the element's own viewport traversal and smoothed by a spring — the
 * spring lag is the inertia. Never duration-eased.
 *
 * <768px: speed is halved; layers marked `mobile={false}` (B/D) render
 * static. Reduced motion: always static.
 */
export function Parallax({
  speed,
  children,
  className,
  mobile = true,
}: {
  speed: number
  children?: React.ReactNode
  className?: string
  mobile?: boolean
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const ok = useMotionOK()
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [amp, setAmp] = React.useState(0)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const h = el.parentElement?.offsetHeight || el.offsetHeight || 0
      const s = isMobile ? speed * 0.5 : speed
      const raw = s * h * 0.5
      setAmp(Math.sign(raw) * Math.min(Math.abs(raw), 120))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [speed, isMobile])

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const raw = useTransform(scrollYProgress, [0, 1], [amp, -amp])
  const y = useSpring(raw, { stiffness: 100, damping: 30, restDelta: 0.001 })

  const inert = !ok || (isMobile && !mobile)

  return (
    <motion.div ref={ref} className={className} style={inert ? undefined : { y }}>
      {children}
    </motion.div>
  )
}
