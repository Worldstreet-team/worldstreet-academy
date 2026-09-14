import Image from "next/image"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

type BrandLockupProps = {
  /** Eyebrow under the wordmark; defaults to the product eyebrow. */
  eyebrow?: string
  /** Alt text for the mark. Empty (decorative) when the wrapper already labels the link. */
  alt?: string
  /** Sidebar variant: text block fills and truncates inside a collapsible rail. */
  truncate?: boolean
  className?: string
}

/**
 * Unified ecosystem lockup (design-system 05-screens): gold wsa-mark 26px +
 * "WorldStreet" Poppins SemiBold 15 + gold uppercase app eyebrow. One
 * implementation for the marketing navbar/footer and all three sidebars.
 */
export function BrandLockup({ eyebrow = BRAND.eyebrow, alt = "", truncate = false, className }: BrandLockupProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Image
        src="/brand/wsa-mark.png"
        alt={alt}
        width={26}
        height={26}
        className="h-[26px] w-[26px] shrink-0 object-contain"
      />
      <span className={cn("grid min-w-0 text-left leading-tight", truncate && "flex-1")}>
        <span className={cn("font-display text-[15px] font-semibold tracking-tight", truncate && "truncate")}>
          {BRAND.wordmark}
        </span>
        <span className={cn("font-sans text-[10px] font-semibold uppercase tracking-[2px] text-ws-gold", truncate && "truncate")}>
          {eyebrow}
        </span>
      </span>
    </span>
  )
}
