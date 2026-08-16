"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { addFrame, useMediaQuery, useMotionOK } from "./bus"

const DragSuppressContext = React.createContext<React.RefObject<boolean> | null>(null)

/**
 * Card `<Link>`s inside a DragRail read this ref in their onClick: when true,
 * the interaction was a drag (> 8px) and the click must be swallowed —
 * including its `autoBookmark` side effect.
 */
export function useDragSuppressed() {
  return React.useContext(DragSuppressContext)
}

type Sample = { t: number; x: number }

/**
 * Edge-bleeding horizontal rail. The base is a native `overflow-x-auto`
 * scroller (scrollbar hidden) so wheel, keyboard and screen readers work for
 * free; touch keeps native momentum plus `scroll-snap x proximity`.
 *
 * Desktop mouse drag adds hand-rolled inertia on the shared rAF bus: while
 * gripping, scrollLeft tracks the pointer directly (no lag); on release the
 * pointer velocity (sampled over the last 100ms) decays at 0.95^(dt/16.67)
 * until |v| < 0.02 px/ms or an edge clamps it. Reduced motion: native scroll
 * only.
 */
export function DragRail({
  children,
  className,
  onFirstDrag,
  onScrollActivity,
}: {
  children?: React.ReactNode
  className?: string
  onFirstDrag?: () => void
  onScrollActivity?: () => void
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const suppressed = React.useRef(false)
  const ok = useMotionOK()
  const coarse = useMediaQuery("(pointer: coarse)")
  const [grabbing, setGrabbing] = React.useState(false)
  const dragState = React.useRef({
    active: false,
    startX: 0,
    startLeft: 0,
    samples: [] as Sample[],
    stopInertia: null as null | (() => void),
    hasDragged: false,
  })

  React.useEffect(() => {
    const d = dragState.current
    return () => {
      d.stopInertia?.()
      d.stopInertia = null
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ok || e.pointerType !== "mouse" || e.button !== 0) return
    const el = scrollerRef.current
    if (!el) return
    const d = dragState.current
    d.stopInertia?.()
    d.stopInertia = null
    d.active = true
    d.startX = e.clientX
    d.startLeft = el.scrollLeft
    d.samples = [{ t: performance.now(), x: e.clientX }]
    suppressed.current = false
    el.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current
    if (!d.active) return
    const el = scrollerRef.current
    if (!el) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 8 && !suppressed.current) {
      suppressed.current = true
      setGrabbing(true)
      if (!d.hasDragged) {
        d.hasDragged = true
        onFirstDrag?.()
      }
    }
    el.scrollLeft = d.startLeft - dx
    onScrollActivity?.()
    const now = performance.now()
    d.samples.push({ t: now, x: e.clientX })
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift()
    if (suppressed.current) e.preventDefault()
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current
    if (!d.active) return
    d.active = false
    setGrabbing(false)
    const el = scrollerRef.current
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)

    // Velocity in px/ms across the ring buffer window.
    const first = d.samples[0]
    const lastSample = d.samples[d.samples.length - 1]
    let v = 0
    if (first && lastSample && lastSample.t - first.t > 16) {
      v = (lastSample.x - first.x) / (lastSample.t - first.t)
    }

    if (Math.abs(v) >= 0.02 && el) {
      d.stopInertia = addFrame((dt) => {
        const node = scrollerRef.current
        if (!node) return false
        v *= Math.pow(0.95, dt / 16.67)
        const before = node.scrollLeft
        node.scrollLeft = before - v * dt
        onScrollActivity?.()
        const max = node.scrollWidth - node.clientWidth
        if (node.scrollLeft <= 0 || node.scrollLeft >= max) return false
        if (Math.abs(v) < 0.02) return false
        return true
      })
    }

    // Clear the click-suppression after the (synchronous) click event fires.
    setTimeout(() => {
      suppressed.current = false
    }, 0)
  }

  return (
    <DragSuppressContext.Provider value={suppressed}>
      <div
        ref={scrollerRef}
        className={cn(
          "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          coarse && "snap-x snap-proximity",
          ok && !coarse && (grabbing ? "cursor-grabbing select-none" : "cursor-grab"),
          className
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onScroll={() => onScrollActivity?.()}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>
    </DragSuppressContext.Provider>
  )
}
