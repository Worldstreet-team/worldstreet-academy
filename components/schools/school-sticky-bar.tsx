"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { SchoolIcon } from "@/components/shared/school-icon"
import { CtaLink, GOLD_CTA, type SchoolCta } from "@/components/schools/cta"

/**
 * The phone bar (below lg): the school and the page's one gold action, for
 * the stretch of page between the hero's button and the closing band's. It
 * shows only once the hero's button has scrolled away, hides while the
 * programs are crossing the middle of the screen (they are the action
 * there) and again once the closing band's button arrives — so a view never
 * carries two gold buttons. `inert` while hidden keeps it out of the tab
 * order. The same idea as the program page's bottom bar.
 */
export function SchoolStickyBar({
  cta,
  name,
  icon,
  meta,
}: {
  cta: SchoolCta
  name: string
  icon: string
  /** "2 programs · from $49" — real figures only; null leaves the line out. */
  meta: string | null
}) {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const vh = window.innerHeight
      const hero = document.querySelector('[data-school-cta="hero"]')
      const closing = document.querySelector('[data-school-cta="closing"]')
      const programs = document.getElementById("programs")?.getBoundingClientRect()
      const heroGone = hero ? hero.getBoundingClientRect().bottom < 0 : true
      const closingHere = closing ? closing.getBoundingClientRect().top < vh : false
      const programsMid = programs ? programs.top < vh / 2 && programs.bottom > vh / 2 : false
      setShow(heroGone && !closingHere && !programsMid)
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
  }, [])

  return (
    <div
      inert={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-ws-hairline bg-ws-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-[transform,opacity] duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] motion-reduce:transition-none lg:hidden",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-ws-raised text-ws-primary sm:flex">
            <SchoolIcon name={icon} size={16} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-semibold text-ws-primary">{name}</p>
            {meta && <p className="truncate text-[12.5px] tabular-nums text-ws-muted">{meta}</p>}
          </div>
        </div>
        <CtaLink cta={cta} className={cn(GOLD_CTA, "h-11 shrink-0 px-5 text-[14px]")}>
          {cta.label}
        </CtaLink>
      </div>
    </div>
  )
}
