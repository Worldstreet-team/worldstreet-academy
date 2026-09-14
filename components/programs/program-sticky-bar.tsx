/**
 * Phone-only bar at the bottom of the program page: the cheapest price and a
 * jump to the ladder. Rendered as the article's last child with `sticky`, so
 * it sticks to the viewport while the article is on screen and parks above
 * the footer at the end. Rendered only while there is something to buy
 * (access "open"); marketing pages have no bottom nav to collide with.
 */
export function ProgramStickyBar({ fromPrice, multiTier }: { fromPrice: number; multiTier: boolean }) {
  return (
    <div className="sticky bottom-0 z-30 border-t border-ws-hairline bg-ws-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">
            {multiTier ? "From" : "Price"}
          </span>
          <span className="font-display text-xl font-semibold tabular-nums text-ws-primary">
            {fromPrice === 0 ? "Free" : `$${fromPrice.toLocaleString("en-US")}`}
          </span>
        </p>
        <a
          href="#packages"
          className="inline-flex h-11 items-center justify-center rounded-full bg-ws-brand px-6 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          {multiTier ? "Choose package" : "Enrol now"}
        </a>
      </div>
    </div>
  )
}
