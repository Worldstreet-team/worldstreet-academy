"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { MenuIcon } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { NavSearch } from "@/components/marketing/nav-search"
import { SchoolRow, type SchoolCounts } from "@/components/marketing/schools-menu"
import { SCHOOLS } from "@/lib/schools"
import { cn } from "@/lib/utils"

export type MarketingNavLink = {
  href: string
  label: string
  /** Rendered as a plain <a> — cross-domain Clerk URLs aren't app routes. */
  external?: boolean
}

const linkClass =
  "flex min-h-11 items-center rounded-[12px] px-3 text-sm font-medium text-ws-primary transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"

const actionClass =
  "inline-flex h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold text-ws-primary ring-1 ring-inset ring-ws-hairline transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"

function NavAnchor({ link, className, onClick }: { link: MarketingNavLink; className: string; onClick: () => void }) {
  return link.external ? (
    <a href={link.href} onClick={onClick} className={className}>
      {link.label}
    </a>
  ) : (
    <Link href={link.href} onClick={onClick} className={className}>
      {link.label}
    </Link>
  )
}

/**
 * The narrow-screen counterpart to the marketplace header. Below lg the bar
 * keeps only the lockup, (md+) Explore and search, and the gold CTA; this
 * sheet holds everything else: the search, the eight schools and the page
 * links scroll; the theme switch sits in the header and the account actions
 * (guests) stay pinned at the foot, so Sign in never needs a scroll.
 */
export function MarketingMobileNav({
  links,
  actions,
  counts,
  className,
}: {
  links: MarketingNavLink[]
  /** Pinned under the scroll area — Sign in / Create an account for guests. */
  actions: MarketingNavLink[]
  counts: SchoolCounts
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          // -mr-1.5: the glyph, not the hit area, lines up with the gutter.
          "ws-touch-target -mr-1.5 flex size-10 shrink-0 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary",
          className
        )}
      >
        <MenuIcon size={20} aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          ref={popupRef}
          side="bottom"
          // A tap opens onto the sheet itself, not the search field — focusing
          // the field would throw up the phone keyboard over the menu.
          // Keyboard users still land on the first control.
          initialFocus={(type) => (type === "keyboard" ? true : popupRef.current)}
          className="gap-0 rounded-t-[20px] bg-ws-surface p-0 outline-none"
        >
          {/* py-2.5 + the 32px toggle centres it on the sheet's close button
              (top-3, 28px). */}
          <SheetHeader className="flex-row items-center justify-between py-2.5 pl-5 pr-12">
            <SheetTitle className="text-base">Menu</SheetTitle>
            <ThemeToggle className="border-transparent text-ws-muted hover:bg-ws-raised hover:text-ws-primary" />
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
            <div className="px-2 pb-2 pt-1">
              <NavSearch
                inputClassName="h-11 dark:bg-ws-sunken dark:hover:bg-ws-sunken dark:focus-visible:bg-ws-sunken"
                onSubmit={close}
              />
            </div>

            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ws-subtle">
              Schools
            </p>
            <ul>
              {SCHOOLS.map((school) => (
                <li key={school.slug}>
                  <SchoolRow school={school} count={counts ? counts[school.slug] : null} onNavigate={close} compact />
                </li>
              ))}
            </ul>

            <nav aria-label="Site" className="mt-2 border-t border-ws-hairline pt-2">
              {links.map((link) => (
                <NavAnchor key={link.href} link={link} className={linkClass} onClick={close} />
              ))}
            </nav>
          </div>

          {actions.length > 0 && (
            <div className="flex gap-2 border-t border-ws-hairline px-5 py-3">
              {actions.map((link) => (
                <NavAnchor key={link.href} link={link} className={actionClass} onClick={close} />
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
