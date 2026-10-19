"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { packagePriceLabel } from "@/lib/program-price"
import { RollingAmount } from "@/components/ui/rolling-amount"
import { actionLabel, cheapestOf } from "@/components/programs/package-model"
import { OfferEnds, PackageDiscount } from "@/components/programs/package-offer"
import { CheckoutLink, jumpToPackages, usePackageSelection } from "@/components/programs/package-selection"

const CTA =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-ws-brand px-6 text-[14px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 active:translate-y-px"

/**
 * The bottom bar, for when no offer is on screen. It follows the package
 * choice: before the visitor has met the chooser it quotes the entry price
 * and jumps to it ("Choose your package"); after, it names the selected tier
 * and its price and goes straight to checkout with it. A single-price
 * program always offers "Enrol now".
 *
 * It hides while an offer's own gold action is in view — the purchase panel
 * (`[data-purchase]`, the lg card or the inline one below lg) or the
 * chooser's CTA (`[data-offer-cta]`) — so a view never carries two gold
 * actions; `inert` while hidden keeps it out of the tab order. Reading down
 * a long package breakdown, past its button, the bar takes over.
 *
 * Rendered as the article's last child with `sticky`, so it pins to the
 * viewport while the article is on screen and parks above the footer at the
 * end. Rendered only while there is something to buy (access "open").
 */
export function ProgramStickyBar({ title, fromPrice }: { title: string; fromPrice: number }) {
  const { packages, multiTier, selected, engaged, offerEndsAt } = usePackageSelection()
  const [show, setShow] = React.useState(false)
  const choosing = multiTier && !engaged
  // The tier whose price is quoted: the entry tier while choosing, else the pick.
  const quoted = choosing ? cheapestOf(packages) : selected

  React.useEffect(() => {
    const targets = [...document.querySelectorAll<HTMLElement>("[data-purchase], [data-offer-cta]")]
    if (targets.length === 0) return
    const inView = new Map<Element, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) inView.set(entry.target, entry.isIntersecting)
        setShow(![...inView.values()].some(Boolean))
      },
      { threshold: 0 }
    )
    for (const el of targets) io.observe(el)
    return () => io.disconnect()
  }, [])

  const { text } = actionLabel(selected, !multiTier)

  return (
    <div
      inert={!show}
      className={cn(
        "sticky bottom-0 z-30 border-t border-ws-hairline bg-ws-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-[transform,opacity] duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] motion-reduce:transition-none",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* From md the title sits on the left, with the offer's countdown under it. */}
        <div className="hidden min-w-0 md:block">
          <p className="truncate font-display text-[15px] font-semibold text-ws-primary">{title}</p>
          <OfferEnds pkg={quoted} endsAt={offerEndsAt} className="mt-1 block truncate text-[12.5px]" />
        </div>
        <div className="flex w-full min-w-0 items-center justify-between gap-4 md:w-auto md:justify-end md:gap-6">
          <div className="min-w-0 leading-none">
            {multiTier && (
              <p
                key={choosing ? "from" : selected.key}
                className="ws-animate-fade truncate text-[12px] font-medium text-ws-muted"
              >
                {choosing ? "From" : PACKAGE_LABEL[selected.key]}
              </p>
            )}
            <span className={cn("flex items-baseline gap-2", multiTier && "mt-1")}>
              <RollingAmount
                value={packagePriceLabel(choosing ? fromPrice : selected.price)}
                className="font-display text-[22px] font-light tracking-[-0.02em] text-ws-primary"
              />
              {/* Phones: the struck price only — the chip joins it from sm. */}
              <PackageDiscount
                key={quoted.key}
                pkg={quoted}
                className="ws-animate-fade flex-nowrap text-[13px]"
                chipClassName="hidden sm:inline-flex"
              />
            </span>
          </div>
          {choosing ? (
            <a href="#packages" onClick={jumpToPackages} className={CTA}>
              Choose your plan
            </a>
          ) : (
            <CheckoutLink className={CTA}>{text}</CheckoutLink>
          )}
        </div>
      </div>
    </div>
  )
}
