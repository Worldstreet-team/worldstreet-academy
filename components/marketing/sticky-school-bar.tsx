"use client"

import * as React from "react"
import Link from "next/link"
import { SCHOOLS, type SchoolSlug } from "@/lib/schools"
import { useStartSchool } from "@/components/marketing/start-school-store"
import { useMotionOK } from "@/components/marketing/motion/bus"
import { cn } from "@/lib/utils"

/**
 * Once the hero's CTA has gone, its one action follows the visitor: the
 * school they picked and the way into it (`/schools/<slug>`), or the
 * invitation to pick one (the `/schools` directory, owner 2026-09-18). It shows
 * only while the hero's CTA row is past and the closing finale band — with
 * its own gold CTA — is off screen, so the page still has one primary action
 * in view. `inert` while hidden keeps it out of the tab order.
 *
 * The hand-off line: the hero's CTA row fades as it climbs the top of the
 * viewport, so the bar rises as that row passes 30% of the viewport — the row
 * at about half strength — a cross-fade rather than a gap with no action.
 * Under reduced motion the row never fades, so the line is the navbar's foot.
 * Only a row ABOVE the line counts as past: on a short screen where it starts
 * below the fold, the bar stays down.
 */
export function StickySchoolBar({ cheapest }: { cheapest: Record<SchoolSlug, number | null> }) {
  const picked = useStartSchool((s) => s.picked)
  const [show, setShow] = React.useState(false)
  const ok = useMotionOK()

  React.useEffect(() => {
    const cta = document.getElementById("hero-cta")
    const lead = cta ?? document.getElementById("hero")
    if (!lead) return
    const finale = document.getElementById("finale")
    let past = false
    let closing = false
    const sync = () => setShow(past && !closing)

    // One target per observer; a batch can hold several entries for it — the last is current.
    const leadIO = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        past = !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)
        sync()
      },
      { threshold: 0, rootMargin: cta && ok ? "-30% 0px 0px 0px" : "-64px 0px 0px 0px" }
    )
    leadIO.observe(lead)
    const finaleIO = new IntersectionObserver(
      (entries) => {
        closing = entries[entries.length - 1].isIntersecting
        sync()
      },
      { threshold: 0 }
    )
    if (finale) finaleIO.observe(finale)
    return () => {
      leadIO.disconnect()
      finaleIO.disconnect()
    }
  }, [ok])

  const school = picked ? SCHOOLS.find((s) => s.slug === picked)! : null
  const from = school ? cheapest[school.slug] : null

  return (
    <div
      inert={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-[var(--ws-motion-base)] motion-reduce:transition-none",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      )}
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-full bg-ws-raised p-2 pl-5 ring-1 ring-ws-hairline">
        {/* Phones have ~170px beside the button: the label takes two lines
            there (the school's name over its price) instead of an ellipsis
            mid-question. sm+ keeps the one truncated line. */}
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-ws-primary max-sm:line-clamp-2 sm:truncate">
          {school ? (
            <>
              <span className="block truncate font-semibold sm:inline">{school.short}</span>
              {from !== null && (
                <span className="block tabular-nums text-ws-muted sm:inline">
                  <span className="hidden sm:inline"> · </span>
                  {from === 0 ? "free to start" : `from $${from.toLocaleString("en-US")}`}
                </span>
              )}
            </>
          ) : (
            "What do you want to master?"
          )}
        </p>
        <Link
          href={school ? `/schools/${school.slug}` : "/schools"}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-ws-brand px-5 text-[14px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          {school ? "Explore school" : "Choose a school"}
        </Link>
      </div>
    </div>
  )
}
