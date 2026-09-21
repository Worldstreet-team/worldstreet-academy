"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { PublicPackage } from "@/lib/actions/student"
import type { PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { packagePriceLabel } from "@/lib/program-price"
import { RollingAmount } from "@/components/ui/rolling-amount"
import { actionLabel, checkoutHref, defaultPackageKey } from "@/components/programs/package-model"

type Selection = {
  courseId: string
  packages: PublicPackage[]
  tierCount: number
  /** More than one tier: the visitor chooses one. */
  multiTier: boolean
  selected: PublicPackage
  /**
   * The visitor has met the choice — picked a tier, arrived with one in the
   * URL, or had the chooser on screen. Until then the card and the bar point
   * at the chooser ("Choose your package"); after it, at checkout for the
   * selected tier. A single-price program is engaged from the start.
   */
  engaged: boolean
  select: (key: PackageKey) => void
  engage: () => void
  /** Checkout for the selected tier. */
  href: string
  signedIn: boolean
}

const SelectionContext = React.createContext<Selection | null>(null)

export function usePackageSelection(): Selection {
  const value = React.useContext(SelectionContext)
  if (!value) throw new Error("usePackageSelection must be used inside PackageSelectionProvider")
  return value
}

/**
 * The program page's one package choice, shared by the chooser (#packages),
 * the purchase card (lg aside + inline) and the bottom bar. It lives in the
 * URL as `?package=<key>` — written with `history.replaceState` (Next syncs
 * its router; no navigation, no scroll) — so checkout's "Change" link lands
 * back on the same choice. The server reads the same param for the first
 * render, so nothing flips on hydration.
 */
export function PackageSelectionProvider({
  courseId,
  packages,
  tierCount,
  initialKey,
  signedIn,
  children,
}: {
  courseId: string
  packages: PublicPackage[]
  tierCount: number
  /** A valid `?package=` from the URL, else null (→ "most popular", else the first). */
  initialKey: PackageKey | null
  signedIn: boolean
  children: React.ReactNode
}) {
  const multiTier = packages.length > 1
  const [key, setKey] = React.useState<PackageKey>(initialKey ?? defaultPackageKey(packages))
  const [engaged, setEngaged] = React.useState(!multiTier || initialKey !== null)

  const select = React.useCallback((next: PackageKey) => {
    setKey(next)
    setEngaged(true)
    const url = new URL(window.location.href)
    url.searchParams.set("package", next)
    window.history.replaceState(null, "", url)
  }, [])
  const engage = React.useCallback(() => setEngaged(true), [])

  const selected = packages.find((p) => p.key === key) ?? packages[0]
  const value = React.useMemo<Selection>(
    () => ({
      courseId,
      packages,
      tierCount,
      multiTier,
      selected,
      engaged,
      select,
      engage,
      href: checkoutHref(courseId, selected, tierCount),
      signedIn,
    }),
    [courseId, packages, tierCount, multiTier, selected, engaged, select, engage, signedIn]
  )

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

/**
 * The link to checkout. Signed in: a client navigation. A guest is sent by the
 * middleware to sign in (the hub, off-origin) with checkout as the return
 * address — a plain anchor goes there directly instead of a client fetch that
 * can only fail across origins and fall back to the same navigation.
 */
export function CheckoutLink({ className, children, ...rest }: React.ComponentProps<"a">) {
  const { href, signedIn } = usePackageSelection()
  if (signedIn) {
    return (
      <Link href={href} className={className} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  )
}

/** Glide to the chooser (instant under reduced motion); a plain anchor without JS. */
export function jumpToPackages(event: React.MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById("packages")
  if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  const url = new URL(window.location.href)
  url.hash = "packages"
  window.history.replaceState(null, "", url)
}

const GOLD_CTA =
  "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ws-brand px-5 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-surface active:translate-y-px"

/**
 * The purchase card's offer (lg aside and inline below lg), for a program on
 * sale. Before the visitor has met the chooser it quotes the entry price and
 * points at the packages; once they have, it names the selected tier, its
 * price (the digits roll when the choice changes) and goes straight to
 * checkout. A single-price program always shows its one offer.
 */
export function SelectedOffer({ fromPrice }: { fromPrice: number }) {
  const { packages, tierCount, multiTier, selected, engaged } = usePackageSelection()
  const choosing = multiTier && !engaged
  const price = choosing ? fromPrice : selected.price
  // The price sits right above the button here, so the button never repeats it.
  const { text } = actionLabel(selected, !multiTier)
  // Spec §8: a single-price program reads "FOUNDING PRICE: $199" — its one tier's name.
  const singleName = !multiTier && tierCount > 0 ? selected.name : null

  return (
    <>
      <p className="flex items-baseline gap-2">
        <RollingAmount
          value={packagePriceLabel(price)}
          className="font-display text-[44px] font-light leading-none tracking-[-0.025em] text-ws-primary"
        />
        {choosing && fromPrice > 0 && <span className="text-[14px] font-medium text-ws-muted">to start</span>}
      </p>

      {/* The sub-line crossfades between "what's on offer" and "what you picked". */}
      {(multiTier || singleName) && (
        <div key={choosing ? "choose" : selected.key} className="ws-animate-fade mt-2.5 text-[13.5px] text-ws-muted">
          {choosing ? (
            <p>
              <span className="tabular-nums">{packages.length}</span> packages · {PACKAGE_LABEL[packages[0].key]} to{" "}
              {PACKAGE_LABEL[packages[packages.length - 1].key]}
            </p>
          ) : multiTier ? (
            <p className="flex min-w-0 items-baseline gap-1.5">
              <span className="shrink-0 font-semibold text-ws-primary">{PACKAGE_LABEL[selected.key]}</span>
              <span aria-hidden className="shrink-0">
                ·
              </span>
              <span className="min-w-0 truncate">{selected.name}</span>
              <a
                href="#packages"
                onClick={jumpToPackages}
                className="ml-auto shrink-0 rounded-sm pl-2 font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
              >
                Change<span className="sr-only"> package</span>
              </a>
            </p>
          ) : (
            <p>{singleName}</p>
          )}
        </div>
      )}

      <div className="mt-5">
        {choosing ? (
          <a href="#packages" onClick={jumpToPackages} className={GOLD_CTA}>
            Choose your package
          </a>
        ) : (
          <CheckoutLink className={GOLD_CTA}>
            {text}
            <ArrowRightIcon size={16} aria-hidden className="-mr-1" />
          </CheckoutLink>
        )}
      </div>
    </>
  )
}
