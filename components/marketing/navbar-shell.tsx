import * as React from "react"

/**
 * The bar's chrome: a full-width solid stone bar with a hairline foot, sticky
 * at the top of every marketing page. Opaque and static — no glass, no
 * scroll-state morph — so the page (the landing hero included) simply starts
 * below it, and no page has to reserve or cancel space for it.
 *
 * Content width and gutters match the page body (`max-w-7xl px-6`), so the
 * lockup sits on the same left edge as every page heading.
 */
export function NavbarShell({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-50 border-b border-ws-hairline bg-ws-page">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-6 sm:h-16 md:gap-3 lg:gap-4">
        {children}
      </div>
    </header>
  )
}
