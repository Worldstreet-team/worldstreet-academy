import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The landing's section opener, in the design system's own register.
 *
 * SectionLabel is the DS Eyebrow (02-typography): 12px SemiBold, +0.08em,
 * MUTED. Gold is for CTAs, active state and brand moments; a label that only
 * names the section it sits on doesn't earn it, and with seven of them in a
 * row the gold CTAs were competing with their own signposts.
 *
 * SectionTitle is the ONE title size for every section after the hero. Each
 * section used to reach for its own clamp, so the page spoke at one volume
 * from top to bottom; the ramp now steps hero → About statement → section
 * title → card title.
 */
export function SectionLabel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={cn("text-[12px] font-semibold uppercase tracking-[0.08em] text-ws-muted", className)}>
      {children}
    </p>
  )
}

export const SECTION_TITLE =
  "font-display text-[clamp(1.875rem,3.2vw,2.625rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-ws-primary"

export function SectionTitle({
  id,
  className,
  children,
}: {
  id?: string
  className?: string
  children: ReactNode
}) {
  return (
    <h2 id={id} className={cn(SECTION_TITLE, className)}>
      {children}
    </h2>
  )
}
