import type * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { CardShell, Skel, SkeletonRows } from "@/components/ui/system"

/* Shared grammar for the student home's tiles (design-system 04: ListRow rows
   separated by hairlines, never a card per row). */

export type Glyph = React.ComponentType<{ className?: string }>

/** A Hugeicons glyph as the kit's `icon` prop — components/ui/system.tsx takes a component. Call at module scope. */
export function glyph(icon: IconSvgElement): Glyph {
  function IconGlyph({ className }: { className?: string }) {
    return <HugeiconsIcon icon={icon} className={className} aria-hidden />
  }
  return IconGlyph
}

/** A tile's row list. */
export const TILE_ROWS = "flex flex-col divide-y divide-border/60"

/** One interactive row: the kit ListRow's box, plus a keyboard focus state. */
export const TILE_ROW =
  "flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"

/** A tile's foot link ("See all"), pinned to the bottom, with the rows' inset keyboard focus ring. */
export const TILE_FOOT_LINK =
  "mt-auto flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:bg-accent/40 focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"

/** Neutral 40px icon chip for data rows — gold chips are kept for navigation rows. */
export const DATA_CHIP = "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-foreground/[0.05]"

export function Chevron() {
  return <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
}

/** A tile while its data loads: the header's two lines, then rows. */
export function TileSkeleton({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <CardShell>
      <div className="flex flex-col gap-2 px-4 py-4">
        <Skel className="h-4 w-28" />
        <Skel className="h-3 w-40" />
      </div>
      <SkeletonRows rows={rows} label={label} />
    </CardShell>
  )
}
