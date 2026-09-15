"use client"

import type * as React from "react"
import { Rise } from "@/components/ui/system"
import { layoutBento, type BentoPrefer } from "@/lib/dashboard-home"
import { cn } from "@/lib/utils"

export type BentoTile = { key: string; prefer: BentoPrefer; node: React.ReactNode }

const STEP_MS = 60

/**
 * The home's paired rows — the hub's bento-grid.tsx rhythm. Each row is its
 * own grid so partners stretch to one bottom edge; each card carries its own
 * Rise so the grid assembles card by card in reading order. The row plan
 * comes from `layoutBento`, so whichever tiles this student has, no row has a
 * hole. Widths are container queries on the page column, which keeps the
 * split right whether the sidebar is open or collapsed: one column, then
 * halves from ~672px, then 3:2 from ~896px.
 */
export function HomeBento({ tiles, delay = 0 }: { tiles: BentoTile[]; delay?: number }) {
  const rows = layoutBento(tiles)
  const nodes = new Map(tiles.map((tile) => [tile.key, tile.node]))
  const order = rows.flatMap((row) => (row.kind === "pair" ? [row.wide, ...row.narrow] : row.keys))
  const delayOf = (key: string) => delay + STEP_MS * order.indexOf(key)

  // Row keys come from the row's first tile id, so a tile joining the end of a
  // row never remounts (and replays Rise on) the tiles already in it.
  return (
    <div className="flex w-full flex-col gap-4">
      {rows.map((row) =>
        row.kind === "pair" ? (
          <div key={`pair-${row.wide}`} className="grid gap-4 @2xl:grid-cols-2 @4xl:grid-cols-5">
            <Rise
              delay={delayOf(row.wide)}
              className={cn("min-w-0 @4xl:col-span-3 [&>div]:h-full", row.wideRight && "@4xl:order-last")}
            >
              {nodes.get(row.wide)}
            </Rise>
            {/* The narrow column can carry two cards; they split its height. */}
            <div className="flex min-w-0 flex-col gap-4 @4xl:col-span-2">
              {row.narrow.map((key) => (
                <Rise key={key} delay={delayOf(key)} className="min-w-0 flex-1 [&>div]:h-full">
                  {nodes.get(key)}
                </Rise>
              ))}
            </div>
          </div>
        ) : (
          <div
            key={`even-${row.keys[0]}`}
            className={cn(
              "grid gap-4",
              row.keys.length === 2 && "@2xl:grid-cols-2",
              row.keys.length === 3 && "@4xl:grid-cols-3"
            )}
          >
            {row.keys.map((key) => (
              <Rise key={key} delay={delayOf(key)} className="min-w-0 [&>div]:h-full">
                {nodes.get(key)}
              </Rise>
            ))}
          </div>
        )
      )}
    </div>
  )
}
