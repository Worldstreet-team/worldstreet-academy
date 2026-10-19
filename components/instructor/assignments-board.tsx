"use client"
import * as React from "react"
import Link from "next/link"

import { CardShell, EmptyState, Segmented, type SegmentedOption } from "@/components/ui/system"
import type { FacultyAssignmentRow } from "@/lib/actions/assignments"
import { shortDate } from "@/lib/faculty-format"

/*
 * The faculty Assignments list (institutional blueprint §16): one row per
 * assignment or project, linking to its program's assignments page, where
 * grading happens. Filtering is local — every row is already loaded.
 */

type View = "waiting" | "all"

const CHIP = "rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums"

function meta(r: FacultyAssignmentRow): string {
  return [
    r.program.title,
    r.kind === "project" ? "Project" : "Assignment",
    r.status === "draft" ? "Draft" : null,
    r.dueAt ? `Due ${shortDate(r.dueAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function AssignmentsBoard({ rows, programs }: { rows: FacultyAssignmentRow[]; programs: number }) {
  const waitingRows = rows.filter((r) => r.waiting > 0)
  const [view, setView] = React.useState<View>(waitingRows.length > 0 ? "waiting" : "all")
  const shown = view === "waiting" ? waitingRows : rows
  const waitingTotal = waitingRows.reduce((n, r) => n + r.waiting, 0)

  const options: readonly SegmentedOption<View>[] = [
    {
      key: "waiting",
      label: "Waiting for a grade",
      badge: <span className="tabular-nums text-muted-foreground">{waitingTotal}</span>,
    },
    { key: "all", label: "All", badge: <span className="tabular-nums text-muted-foreground">{rows.length}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented options={options} value={view} onChange={setView} />
        <p className="text-[13px] tabular-nums text-muted-foreground">
          {rows.length === 1 ? "1 assignment" : `${rows.length} assignments`} ·{" "}
          {programs === 1 ? "1 program" : `${programs} programs`}
        </p>
      </div>

      <CardShell>
        {shown.length === 0 ? (
          <EmptyState
            title="Nothing waiting for a grade"
            description="New submissions appear here until you grade them."
          />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-medium">{r.title}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{meta(r)}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-2">
                    {r.waiting > 0 && <span className={`${CHIP} bg-ws-warning/10 text-ws-warning`}>{r.waiting} waiting</span>}
                    <span className={`${CHIP} bg-ws-chip text-muted-foreground`}>
                      {r.submissions === 1 ? "1 submission" : `${r.submissions} submissions`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardShell>
    </div>
  )
}
