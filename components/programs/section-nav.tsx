"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type SectionLink = { id: string; label: string }

/**
 * The program page's in-page nav: sticky under the site navbar, solid page
 * fill + hairline (the glass ban), a link per section that actually rendered.
 * The active link — the last section whose top has passed under the nav —
 * reads ink with a 2px gold underline (gold = active state). Phones scroll it
 * sideways with no visible scrollbar, and the active link is kept in view.
 *
 * Plain anchors underneath: without JS every link still jumps, and the
 * sections' `scroll-mt-*` clears the stuck chrome either way. With JS the
 * jump glides (instant under reduced motion) and the hash still updates.
 */
export function SectionNav({ links }: { links: SectionLink[] }) {
  const [active, setActive] = React.useState<string | null>(links[0]?.id ?? null)
  const navRef = React.useRef<HTMLElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)

  React.useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      // The reading line sits a quarter of the way down the visible area under
      // the nav (never closer than the sections' scroll margin, so a
      // jumped-to section always reads as the active one): a section counts
      // as current once its heading is where the eye is, not only once it
      // has touched the nav.
      const navBottom = navRef.current?.getBoundingClientRect().bottom ?? 0
      const line = navBottom + Math.max(32, (window.innerHeight - navBottom) * 0.25)
      let current: string | null = links[0]?.id ?? null
      for (const link of links) {
        const el = document.getElementById(link.id)
        if (el && el.getBoundingClientRect().top <= line) current = link.id
      }
      // At the very bottom the last short section can never reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = links[links.length - 1]?.id ?? current
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [links])

  // Keep the active link inside the phone's scrolled strip.
  React.useEffect(() => {
    const list = listRef.current
    const el = active ? list?.querySelector<HTMLElement>(`[data-section="${active}"]`) : null
    if (!list || !el) return
    const left = el.offsetLeft - 24
    const right = el.offsetLeft + el.offsetWidth + 24
    if (left < list.scrollLeft) list.scrollTo({ left })
    else if (right > list.scrollLeft + list.clientWidth) list.scrollTo({ left: right - list.clientWidth })
  }, [active])

  function jump(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id)
    if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    history.replaceState(null, "", `#${id}`)
    setActive(id)
  }

  return (
    <nav ref={navRef} aria-label="On this page" className="relative h-full">
      <ul
        ref={listRef}
        className="no-scrollbar -mx-6 flex h-full items-stretch gap-1 overflow-x-auto px-4 sm:gap-2 lg:mx-0 lg:px-0"
      >
        {links.map((link) => {
          const current = link.id === active
          return (
            <li key={link.id} className="flex shrink-0">
              <a
                href={`#${link.id}`}
                data-section={link.id}
                aria-current={current ? "location" : undefined}
                onClick={(event) => jump(event, link.id)}
                className={cn(
                  "relative flex items-center px-2 text-[14px] font-medium transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40 sm:px-3",
                  current ? "text-ws-primary" : "text-ws-muted hover:text-ws-primary"
                )}
              >
                {link.label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ws-brand transition-opacity duration-[var(--ws-motion-base)] sm:inset-x-3",
                    current ? "opacity-100" : "opacity-0"
                  )}
                />
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
