"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * An always-visible scrollbar for the hero's sideways chip row on phones
 * (owner, 2026-09-18). Native mobile scrollbars are overlays that only flash
 * while swiping, and iOS ignores scrollbar styling, so this draws its own
 * track and thumb: the thumb's width is the visible share of the row and it
 * follows the row's scroll. Tapping or dragging the track scrolls the row.
 * Hidden from sm (the chips wrap there) and whenever the row fits.
 * Decorative for assistive tech: the chips themselves are the controls.
 */
export function HeroChipScrollbar({
  rowRef,
  className,
}: {
  rowRef: React.RefObject<HTMLElement | null>
  className?: string
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const thumbRef = React.useRef<HTMLDivElement>(null)

  // Style writes go straight to the elements: no re-render per scroll event.
  // Starts hidden (server and first paint); shown only once the row overflows.
  React.useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const paint = () => {
      const thumb = thumbRef.current
      const fits = row.scrollWidth <= row.clientWidth + 1
      if (wrapRef.current) wrapRef.current.style.display = fits ? "none" : "block"
      if (!thumb || fits) return
      thumb.style.width = `${(row.clientWidth / row.scrollWidth) * 100}%`
      thumb.style.transform = `translateX(${(row.scrollLeft / row.clientWidth) * 100}%)`
    }
    paint()
    row.addEventListener("scroll", paint, { passive: true })
    const ro = new ResizeObserver(paint)
    ro.observe(row)
    return () => {
      row.removeEventListener("scroll", paint)
      ro.disconnect()
    }
  }, [rowRef])

  // Tap or drag anywhere on the track: centre the thumb under the finger.
  const scrollTo = (clientX: number) => {
    const row = rowRef.current
    const track = trackRef.current
    if (!row || !track) return
    const r = track.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const visible = row.clientWidth / row.scrollWidth
    const start = Math.min(1 - visible, Math.max(0, frac - visible / 2))
    row.scrollLeft = start * row.scrollWidth
  }

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn("hidden py-2 sm:hidden!", className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        scrollTo(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) scrollTo(e.clientX)
      }}
      style={{ touchAction: "none" }}
    >
      <div ref={trackRef} className="relative h-1 overflow-hidden rounded-full bg-ws-hairline">
        <div ref={thumbRef} className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-ws-muted" />
      </div>
    </div>
  )
}
