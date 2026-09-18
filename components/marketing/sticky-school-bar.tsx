"use client"

import * as React from "react"
import Link from "next/link"
import { SCHOOLS, type SchoolSlug } from "@/lib/schools"
import { useStartSchool } from "@/components/marketing/start-school-store"
import { cn } from "@/lib/utils"

/**
 * Once the hero has scrolled away, its one action follows the visitor: the
 * school they picked (or the invitation to pick one) and the way in. It shows
 * only while both the hero and the closing finale band — each with its own
 * gold CTA — are off screen, so the page still has one primary action in
 * view. `inert` while hidden keeps it out of the tab order.
 */
export function StickySchoolBar({ cheapest }: { cheapest: Record<SchoolSlug, number | null> }) {
  const picked = useStartSchool((s) => s.picked)
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    const hero = document.getElementById("hero")
    if (!hero) return
    const finale = document.getElementById("finale")
    const inView = new Map<Element, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) inView.set(entry.target, entry.isIntersecting)
        setShow(![...inView.values()].some(Boolean))
      },
      { threshold: 0 }
    )
    io.observe(hero)
    if (finale) io.observe(finale)
    return () => io.disconnect()
  }, [])

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
        <p className="min-w-0 flex-1 truncate text-[13.5px] text-ws-primary">
          {school ? (
            <>
              <span className="font-semibold">{school.short}</span>
              {from !== null && (
                <span className="tabular-nums text-ws-muted">
                  {" "}· {from === 0 ? "free to start" : `from $${from.toLocaleString("en-US")}`}
                </span>
              )}
            </>
          ) : (
            "What do you want to master?"
          )}
        </p>
        <Link
          href={school ? `/dashboard/start?school=${school.slug}` : "/#schools"}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-ws-brand px-5 text-[14px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          {school ? "Start" : "Choose a school"}
        </Link>
      </div>
    </div>
  )
}
