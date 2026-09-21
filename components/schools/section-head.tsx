import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SECTION_TITLE } from "@/components/marketing/section-heading"

/**
 * A school-page section: the page gutter, the gap above it, and the scroll
 * margin that lands a section-nav jump just under the stuck chrome (site
 * navbar 56/64px + section nav 48px) — the section's own top padding is the
 * breathing room above its heading.
 */
export const SCHOOL_SECTION = "mx-auto max-w-7xl scroll-mt-14 px-6 pt-20 md:scroll-mt-10 md:pt-28"

/**
 * The section opener: the landing's one section-title size (the FAQ at the
 * foot of the page uses it too, so the page speaks at one volume), an
 * optional lede, and an optional aside on the right (a count, a link).
 */
export function SectionHead({
  id,
  title,
  lede,
  aside,
  className,
}: {
  id: string
  title: ReactNode
  lede?: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-10 gap-y-4", className)}>
      <div className="max-w-2xl">
        <h2 id={id} className={SECTION_TITLE}>
          {title}
        </h2>
        {lede && <p className="mt-4 text-pretty text-[16px] leading-relaxed text-ws-muted md:text-[17px]">{lede}</p>}
      </div>
      {aside}
    </div>
  )
}
