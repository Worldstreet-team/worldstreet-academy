"use client"

import Link from "next/link"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Award01Icon, Notebook01Icon, TaskDone01Icon } from "@hugeicons/core-free-icons"
import { Chevron, DATA_CHIP, TILE_FOOT_LINK, TILE_ROW, TILE_ROWS } from "@/components/dashboard/tile-bits"
import { CardHeader, CardShell } from "@/components/ui/system"
import type { MyAssessment } from "@/lib/actions/exams"
import { assessmentCounts, formatDateTime } from "@/lib/dashboard-home"
import { useMyAssessments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

/** Status chip label + wash. Shared with /dashboard/assignments. Chips are washes with full-strength text (design-system 01). */
export const ASSESSMENT_STATUS: Record<MyAssessment["status"], { label: string; className: string }> = {
  not_started: { label: "Not started", className: "bg-foreground/[0.06] text-muted-foreground" },
  in_progress: { label: "In progress", className: "bg-warning-chip text-warning" },
  passed: { label: "Passed", className: "bg-credit-chip text-credit" },
  failed: { label: "Failed", className: "bg-debit-chip text-debit" },
  locked: { label: "Finish lessons first", className: "bg-foreground/[0.06] text-muted-foreground" },
  submitted: { label: "Submitted", className: "bg-foreground/[0.06] text-foreground" },
  graded: { label: "Graded", className: "bg-credit-chip text-credit" },
}

/** "Final exam" · "Knowledge check" · "Assignment" (with its due date). */
export function assessmentKindLabel(assessment: MyAssessment): string {
  if (assessment.scope === "final") return "Final exam"
  if (assessment.scope === "lesson") return "Knowledge check"
  return assessment.dueAt ? `Assignment · due ${formatDateTime(assessment.dueAt)}` : "Assignment"
}

const KIND_ICON: Record<MyAssessment["scope"], IconSvgElement> = {
  final: Award01Icon,
  lesson: TaskDone01Icon,
  assignment: Notebook01Icon,
}

const ROWS_SHOWN = 5

/**
 * Spec §12 Assignments: the knowledge checks and final exams the student's
 * packages include (D7 lite) and practical assignments (Phase 7), with state.
 * Hidden while loading and when there is nothing — an empty tile would imply work exists.
 */
export function AssignmentsTile() {
  const { data: assessments = [] } = useMyAssessments()
  if (assessments.length === 0) return null

  const { toDo, done } = assessmentCounts(assessments)

  return (
    <CardShell>
      <CardHeader
        title="Assignments"
        subtitle={`${toDo} to do · ${done} done`}
        link={{ label: "See all", href: "/dashboard/assignments" }}
      />
      <div className={TILE_ROWS}>
        {assessments.slice(0, ROWS_SHOWN).map((a) => {
          const meta = `${assessmentKindLabel(a)} · ${a.courseTitle}`
          return (
            <Link key={`${a.scope}-${a.id}`} href={a.href} className={TILE_ROW}>
              <span className={DATA_CHIP}>
                <HugeiconsIcon icon={KIND_ICON[a.scope]} className="h-[18px] w-[18px] text-muted-foreground" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-medium" title={a.title}>
                  {a.title}
                </span>
                <span className="truncate text-[12.5px] text-muted-foreground" title={meta}>
                  {meta}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  ASSESSMENT_STATUS[a.status].className
                )}
              >
                {ASSESSMENT_STATUS[a.status].label}
              </span>
            </Link>
          )
        })}
      </div>
      {assessments.length > ROWS_SHOWN && (
        <Link href="/dashboard/assignments" className={TILE_FOOT_LINK}>
          {assessments.length - ROWS_SHOWN} more
          <Chevron />
        </Link>
      )}
    </CardShell>
  )
}
