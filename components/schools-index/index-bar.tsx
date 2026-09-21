"use client"

import * as React from "react"
import type { SchoolSlug } from "@/lib/schools"
import { cn } from "@/lib/utils"
import { SearchField } from "./search-field"
import type { IndexSchool } from "./model"

/**
 * The index's follow-along bar (md+): once the header's search has scrolled
 * away and the schools are on screen, a solid bar drops in under the navbar
 * with the same search (one query, two fields) and, from lg, a jump list of
 * the eight schools that marks the one you are reading — its number and
 * name, the rest numbers only. Solid page fill and a hairline foot, like the
 * navbar (no glass). `inert` while hidden keeps it out of the tab order.
 *
 * Phones skip it: there the header's search sits right above the list.
 */
export function IndexBar({
  show,
  schools,
  lit,
  current,
  query,
  onQuery,
  onSubmit,
  onJump,
}: {
  show: boolean
  schools: readonly IndexSchool[]
  lit: ReadonlySet<SchoolSlug> | null
  current: SchoolSlug | null
  query: string
  onQuery: (next: string) => void
  onSubmit: () => void
  onJump: (slug: SchoolSlug) => void
}) {
  return (
    <div
      inert={!show}
      className={cn(
        "fixed inset-x-0 top-[65px] z-40 hidden border-b border-ws-hairline bg-ws-page transition-[transform,opacity] duration-[var(--ws-motion-base)] ease-[var(--ws-ease)] motion-reduce:transition-none md:block",
        show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        <SearchField
          id="schools-search-bar"
          size="md"
          value={query}
          onChange={onQuery}
          onSubmit={onSubmit}
          className="w-full max-w-xs shrink-0"
        />
        <nav aria-label="Schools on this page" className="ml-auto hidden min-w-0 lg:block">
          <ul className="flex items-center gap-1">
            {schools.map((school) => {
              const on = school.slug === current
              const dim = lit !== null && !lit.has(school.slug)
              return (
                <li key={school.slug} className="min-w-0">
                  <a
                    href={`#${school.slug}`}
                    onClick={(e) => {
                      e.preventDefault()
                      onJump(school.slug)
                    }}
                    aria-current={on ? "location" : undefined}
                    title={school.name}
                    className={cn(
                      "flex h-9 min-w-9 items-center justify-center gap-2 rounded-full px-2.5 text-[13px] tabular-nums transition-colors duration-[var(--ws-motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40",
                      on
                        ? "bg-ws-surface font-semibold text-ws-primary ring-1 ring-ws-hairline dark:bg-ws-raised dark:ring-0"
                        : "text-ws-muted hover:bg-ws-chip hover:text-ws-primary",
                      dim && !on && "opacity-40"
                    )}
                  >
                    <span>{school.number}</span>
                    {on && <span className="max-w-[16rem] truncate">{school.short}</span>}
                    {!on && <span className="sr-only">{school.short}</span>}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  )
}
