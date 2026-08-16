"use client"

import * as React from "react"
import { addFrame, lerpStep, useMediaQuery, useMotionOK } from "./bus"

/**
 * Pointer tilt (certificate only): rotateX/Y up to 5°, lerped at F=0.08 on
 * the shared rAF bus. On leave the card eases home over 600ms
 * `--ws-ease-rise` via a CSS transition (the spec'd reset), which is cleared
 * again the moment the pointer re-enters. Never animates shadow or scale.
 * Disabled on coarse pointers and under reduced motion.
 */
export function TiltCard({
  children,
  className,
  maxDeg = 5,
}: {
  children?: React.ReactNode
  className?: string
  maxDeg?: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const ok = useMotionOK()
  const coarse = useMediaQuery("(pointer: coarse)")
  const state = React.useRef({
    rx: 0,
    ry: 0,
    tx: 0,
    ty: 0,
    hovering: false,
    subscribed: null as null | (() => void),
  })

  const enabled = ok && !coarse

  const ensureLoop = React.useCallback(() => {
    const s = state.current
    if (s.subscribed) return
    s.subscribed = addFrame((dt) => {
      const el = ref.current
      if (!el) {
        s.subscribed = null
        return false
      }
      s.rx = lerpStep(s.rx, s.tx, 0.08, dt)
      s.ry = lerpStep(s.ry, s.ty, 0.08, dt)
      el.style.transform = `perspective(800px) rotateX(${s.rx.toFixed(3)}deg) rotateY(${s.ry.toFixed(3)}deg)`
      const settled =
        Math.abs(s.rx - s.tx) < 0.01 && Math.abs(s.ry - s.ty) < 0.01
      if (settled && !s.hovering) {
        s.subscribed = null
        return false
      }
      return true
    })
  }, [])

  React.useEffect(() => {
    return () => {
      state.current.subscribed?.()
      // eslint-disable-next-line react-hooks/exhaustive-deps
      state.current.subscribed = null
    }
  }, [])

  if (!enabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ willChange: "transform" }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return
        const el = ref.current
        if (el) el.style.transition = ""
        state.current.hovering = true
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return
        const el = ref.current
        if (!el) return
        el.style.transition = ""
        const rect = el.getBoundingClientRect()
        const px = (e.clientX - rect.left) / rect.width - 0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5
        state.current.tx = -py * 2 * maxDeg
        state.current.ty = px * 2 * maxDeg
        state.current.hovering = true
        ensureLoop()
      }}
      onPointerLeave={() => {
        const s = state.current
        s.hovering = false
        s.tx = 0
        s.ty = 0
        s.rx = 0
        s.ry = 0
        s.subscribed?.()
        s.subscribed = null
        const el = ref.current
        if (el) {
          // Spec'd reset: 600ms --ws-ease-rise back to identity.
          el.style.transition = "transform 600ms var(--ws-ease-rise)"
          el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)"
        }
      }}
    >
      {children}
    </div>
  )
}
