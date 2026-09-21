import Link from "next/link"

/**
 * Where the school page sends a visitor next (blueprint §17/§18: School →
 * Program → Package → Checkout): `#programs` when there are programs to choose
 * between, the program page when there is exactly one — that is where the
 * package is chosen.
 */
export type SchoolCta = { href: string; label: string }

/**
 * The page's one gold button. The hero, the closing band and the phone bar
 * all carry it, and only one of them is ever on screen at a time (the bar
 * hides while either of the others is in view — `data-school-cta`).
 */
export const GOLD_CTA =
  "inline-flex h-12 items-center justify-center rounded-full bg-ws-brand px-7 text-[15px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ws-page active:translate-y-px"

/** In-page jumps stay plain anchors (the browser scrolls, the hash updates); routes go through Link. */
export function CtaLink({
  cta,
  className,
  children,
  ...rest
}: {
  cta: SchoolCta
  className?: string
  children: React.ReactNode
  /** Marks the hero's and the closing band's gold button for the phone bar (`SchoolStickyBar`). */
  "data-school-cta"?: "hero" | "closing"
}) {
  return cta.href.startsWith("#") ? (
    <a href={cta.href} className={className} {...rest}>
      {children}
    </a>
  ) : (
    <Link href={cta.href} className={className} {...rest}>
      {children}
    </Link>
  )
}
