"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The lg purchase card's sticky frame. While the hero band is on screen the
 * card shows the program art; once the band has scrolled up under the
 * navbars the art folds away (`data-compact`), so price, action and the
 * includes list fit a laptop viewport while the card follows the reader down
 * the page — the Udemy sidebar behaviour. Without JS the card simply keeps
 * its art.
 *
 * `topOffset` is the height of the stuck chrome above the card (site navbar +
 * section nav): the band counts as gone once it is entirely under it.
 */
export function StickyPurchase({
  watchId,
  topOffset,
  className,
  children,
}: {
  watchId: string
  topOffset: number
  className?: string
  children: React.ReactNode
}) {
  const [compact, setCompact] = React.useState(false)

  React.useEffect(() => {
    const target = document.getElementById(watchId)
    if (!target) return
    const io = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: `-${topOffset}px 0px 0px 0px`, threshold: 0 }
    )
    io.observe(target)
    return () => io.disconnect()
  }, [watchId, topOffset])

  return (
    <div data-compact={compact ? "" : undefined} className={cn("group/purchase", className)}>
      {children}
    </div>
  )
}
