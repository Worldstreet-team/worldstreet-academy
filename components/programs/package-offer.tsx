import { CalendarRangeIcon } from "@/components/icons"

import type { PublicPackage } from "@/lib/actions/student"
import { packagePriceLabel } from "@/lib/program-price"
import { cn } from "@/lib/utils"
import { CohortCountdown } from "@/components/shared/cohort-countdown"
import { discountOf } from "@/components/programs/package-model"

/**
 * The launch offer as every package price shows it (owner, 2026-10-03): the
 * pre-discount price struck through in muted text and a neutral "Save NN%"
 * chip beside the price, and — where a package's detail or action is shown —
 * "Offer ends in 12d 04h 31m 09s", counting down to the live cohort start
 * (lib/cohort.ts) and gone, prefix and all, once it begins. A package without
 * a list price above its price shows none of it. No gold: gold is for the
 * primary action. Server-safe; the countdown is its own client component.
 */

type Priced = Pick<PublicPackage, "price" | "listPrice">

/**
 * The struck list price and the saving, side by side. `chip`: "full" reads
 * "Save 83%"; "compact" reads "−83%" below `sm` (a narrow table column) and
 * "Save 83%" from `sm`. `chipClassName` can hide the chip where space is short.
 */
export function PackageDiscount({
  pkg,
  chip = "full",
  className,
  chipClassName,
}: {
  pkg: Priced
  chip?: "full" | "compact"
  className?: string
  chipClassName?: string
}) {
  const discount = discountOf(pkg)
  if (!discount) return null
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <s className="tabular-nums text-ws-muted decoration-1">
        <span className="sr-only">Original price </span>
        {packagePriceLabel(discount.listPrice)}
      </s>
      {discount.percent >= 1 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-semibold leading-tight tabular-nums text-ws-primary",
            chipClassName
          )}
        >
          {chip === "compact" ? (
            <>
              <span aria-hidden className="sm:hidden">
                −{discount.percent}%
              </span>
              <span className="sr-only sm:not-sr-only">Save {discount.percent}%</span>
            </>
          ) : (
            <>Save {discount.percent}%</>
          )}
        </span>
      )}
    </span>
  )
}

/**
 * "Offer ends in 12d 04h 31m 09s" — only for a package on launch discount.
 * The countdown renders nothing once the cohort starts, so `className`
 * carries any spacing (a wrapper would strand an empty gap).
 */
export function OfferEnds({ pkg, className }: { pkg: Priced; className?: string }) {
  if (!discountOf(pkg)) return null
  return (
    <CohortCountdown
      variant="compact"
      prefix="Offer ends in "
      className={cn("text-[13px] font-medium text-ws-muted", className)}
    />
  )
}

/** "Duration  9 weeks" — a labelled line; nothing when the package states none. */
export function PackageDuration({ duration, className }: { duration: string | null; className?: string }) {
  if (!duration) return null
  return (
    <p className={cn("flex items-center gap-1.5 text-[13.5px] text-ws-muted", className)}>
      <CalendarRangeIcon size={14} className="shrink-0" aria-hidden />
      <span>Duration</span>
      <span className="font-medium text-ws-primary">{duration}</span>
    </p>
  )
}
