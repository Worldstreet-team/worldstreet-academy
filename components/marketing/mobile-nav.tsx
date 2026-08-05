"use client"

import { useState } from "react"
import Link from "next/link"
import { MenuIcon } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export type MarketingNavLink = {
  href: string
  label: string
  /** Rendered as a plain <a> — cross-domain Clerk URLs aren't app routes. */
  external?: boolean
}

/**
 * Mobile counterpart to the marketing navbar's `hidden md:flex` link row.
 *
 * Two problems it solves at once: below md those links had no replacement at
 * all, and keeping the full CTA pair inline overflowed a 320px viewport (the
 * lockup plus a theme toggle plus two buttons needs ~336px in a 288px gutter).
 * Secondary destinations move in here; the primary CTA stays in the bar.
 */
export function MarketingMobileNav({ links }: { links: MarketingNavLink[] }) {
  const [open, setOpen] = useState(false)

  if (links.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="ws-touch-target flex size-9 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-[var(--ws-motion-fast)] hover:bg-muted hover:text-foreground md:hidden"
      >
        <MenuIcon size={20} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-lg p-0">
          <SheetHeader className="px-4 pb-1 pt-4">
            <SheetTitle className="text-base">Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col px-2 pb-3">
            {links.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-foreground transition-colors duration-[var(--ws-motion-fast)] hover:bg-muted"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-foreground transition-colors duration-[var(--ws-motion-fast)] hover:bg-muted"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
