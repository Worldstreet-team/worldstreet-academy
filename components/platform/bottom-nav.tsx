"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  Bookmark02Icon,
  DashboardSquare01Icon,
  Mic01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

type BottomNavItem = {
  title: string
  href: string
  icon: typeof DashboardSquare01Icon
  match?: (pathname: string) => boolean
}

const navItems: BottomNavItem[] = [
  {
    title: "Home",
    href: "/dashboard",
    icon: DashboardSquare01Icon,
    match: (p: string) => p === "/dashboard",
  },
  {
    title: "My programs",
    href: "/dashboard/my-courses",
    icon: BookOpen01Icon,
    match: (p: string) => p === "/dashboard/my-courses",
  },
  {
    title: "Bookmarks",
    href: "/dashboard/bookmarks",
    icon: Bookmark02Icon,
    match: (p: string) => p === "/dashboard/bookmarks",
  },
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: UserIcon,
    match: (p: string) => p === "/dashboard/profile",
  },
]

// The hosted Vivid widget (loaded site-wide in the root layout) mounts its orb
// asynchronously and only when the platform accepts this origin — so the
// center AI button is a proxy: it appears once the orb exists and clicking it
// forwards to the widget. No orb, no button, no crash.
function findVividOrb(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("[data-vivid] button") ??
    document.querySelector<HTMLElement>("[data-vivid]")
  )
}

/**
 * Mobile tab bar — the hub's floating capsule (mobile-bottom-nav.tsx) on
 * solid chrome: inset from the edges, card fill + hairline, the active tab in
 * a raised lozenge with a gold icon. Content scrolls under it; pages clear it
 * with `pb-24`. The Vivid proxy is a static gold chip — no ambient animation.
 */
export function PlatformBottomNav() {
  const pathname = usePathname()
  const [orbReady, setOrbReady] = React.useState(false)

  // Look for the orb every 500ms for up to 15s. The first look is scheduled
  // on the next tick rather than run in the effect body, so an orb that
  // already exists still shows the button without waiting a whole interval.
  React.useEffect(() => {
    const started = Date.now()
    const look = () => {
      if (findVividOrb()) {
        setOrbReady(true)
        window.clearInterval(poll)
      } else if (Date.now() - started > 15_000) {
        window.clearInterval(poll)
      }
    }
    const poll = window.setInterval(look, 500)
    const first = window.setTimeout(look, 0)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(poll)
    }
  }, [])

  const renderItem = (item: BottomNavItem) => {
    const active = item.match?.(pathname) ?? pathname === item.href
    return (
      <Link
        key={item.title}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-1 py-1.5 outline-none transition-colors duration-[var(--ws-motion-fast)] focus-visible:ring-2 focus-visible:ring-primary/40",
          active
            ? "bg-accent text-foreground ring-1 ring-foreground/[0.08]"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <HugeiconsIcon icon={item.icon} className={cn("size-5 shrink-0", active && "text-primary")} />
        <span className="max-w-full truncate text-[10px] font-semibold leading-none">{item.title}</span>
      </Link>
    )
  }

  const left = navItems.slice(0, 2)
  const right = navItems.slice(2)

  return (
    <nav
      aria-label="Primary"
      className="safe-area-bottom pointer-events-none fixed inset-x-4 bottom-3 z-50 md:hidden"
    >
      <div className="pointer-events-auto mx-auto flex max-w-sm items-center gap-0.5 rounded-full border border-border bg-card p-1.5 shadow-(--ws-shadow-nav)">
        {left.map(renderItem)}

        {/* Vivid — the assistant's door, a static gold chip in the centre slot */}
        {orbReady && (
          <button
            type="button"
            onClick={() => findVividOrb()?.click()}
            aria-label="Open Vivid AI assistant"
            className="flex shrink-0 items-center justify-center rounded-full px-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/[0.14] text-primary ring-1 ring-primary/25">
              <HugeiconsIcon icon={Mic01Icon} className="size-5" />
            </span>
          </button>
        )}

        {right.map(renderItem)}
      </div>
    </nav>
  )
}
