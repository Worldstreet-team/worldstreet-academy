"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The bar's chrome, split out because the navbar itself is a server component
 * (it reads auth) and this half needs scroll state.
 *
 * At the top of the page it is invisible — no surface, no border — so the
 * hero wall runs edge to edge beneath it. Past 24px it condenses into a
 * floating glass pill: blurred stone, hairline, soft shadow. The header is
 * fixed, so the layout adds matching top padding and the hero cancels it.
 */
export function NavbarShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 rounded-full border px-3 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] sm:h-16 sm:px-5",
          scrolled
            ? "border-ws-hairline bg-ws-surface/80 shadow-lg shadow-black/25 backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        {children}
      </div>
    </header>
  )
}
