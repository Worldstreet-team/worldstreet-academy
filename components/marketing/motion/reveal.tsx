"use client"

import * as React from "react"
import { motion } from "motion/react"
import { EASE_INERTIA } from "./ease"
import { useMotionOK } from "./bus"

const TAGS = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  span: motion.span,
  li: motion.li,
  figure: motion.figure,
} as const

export type RevealTag = keyof typeof TAGS

/**
 * Fade-up entrance: opacity 0 / y 24 → visible, 700ms EASE_INERTIA, fired
 * once at 30% in view. Reduced motion → opacity-only, 250ms.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  duration = 0.7,
  amount = 0.3,
  as = "div",
}: {
  children?: React.ReactNode
  className?: string
  delay?: number
  y?: number
  duration?: number
  amount?: number
  as?: RevealTag
}) {
  const ok = useMotionOK()
  const Tag = TAGS[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: ok ? y : 0 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount, margin: "-10% 0px" }}
      transition={{
        duration: ok ? duration : 0.25,
        ease: EASE_INERTIA,
        delay: ok ? delay : 0,
      }}
    >
      {children}
    </Tag>
  )
}

/**
 * Staggers each direct child through a Reveal, 80ms apart (60–90ms ladder).
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  delay = 0,
  y = 24,
  as = "div",
}: {
  children?: React.ReactNode
  className?: string
  stagger?: number
  delay?: number
  y?: number
  as?: RevealTag
}) {
  const items = React.Children.toArray(children)
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Reveal key={i} as={as} delay={delay + i * stagger} y={y}>
          {child}
        </Reveal>
      ))}
    </div>
  )
}
