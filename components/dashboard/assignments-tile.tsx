"use client"

import Link from "next/link"
import { ClipboardCheckIcon } from "lucide-react"
import { DashboardTile } from "@/components/dashboard/home-tiles"
import type { MyAssessment } from "@/lib/actions/exams"
import { formatDateTime } from "@/lib/dashboard-home"
import { useMyAssessments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

export const ASSESSMENT_STATUS: Record<MyAssessment["status"], { label: string; className: string }> = {
  not_started: { label: "Not started", className: "bg-ws-chip text-ws-muted" },
  in_progress: { label: "In progress", className: "bg-ws-warning/10 text-ws-warning" },
  passed: { label: "Passed", className: "bg-ws-success/10 text-ws-success" },
  failed: { label: "Failed", className: "bg-ws-danger/10 text-ws-danger" },
  locked: { label: "Finish lessons first", className: "bg-ws-chip text-ws-muted" },
  submitted: { label: "Submitted", className: "bg-ws-chip text-ws-primary" },
  graded: { label: "Graded", className: "bg-ws-success/10 text-ws-success" },
}

/** "Final exam" · "Knowledge check" · "Assignment" (with its due date). */
export function assessmentKindLabel(assessment: MyAssessment): string {
  if (assessment.scope === "final") return "Final exam"
  if (assessment.scope === "lesson") return "Knowledge check"
  return assessment.dueAt ? `Assignment · due ${formatDateTime(assessment.dueAt)}` : "Assignment"
}

/** Nothing left for the student to do on these (a submitted assignment awaits the instructor). */
const DONE: ReadonlySet<MyAssessment["status"]> = new Set(["passed", "submitted", "graded"])

/**
 * Spec §12 Assignments: the knowledge checks and final exams the student's
 * packages include (D7 lite) and practical assignments (Phase 7), with state.
 * Hidden while loading and when there is nothing — an empty tile would imply work exists.
 */
export function AssignmentsTile() {
  const { data: assessments = [] } = useMyAssessments()
  if (assessments.length === 0) return null

  const done = assessments.filter((a) => DONE.has(a.status)).length

  return (
    <DashboardTile
      icon={ClipboardCheckIcon}
      title="Assignments"
      action={assessments.length > 4 ? { label: "View all", href: "/dashboard/assignments" } : undefined}
    >
      <p className="mb-3 text-[13px] text-ws-muted">
        <span className="font-semibold tabular-nums text-ws-primary">{assessments.length - done}</span> to do ·{" "}
        <span className="tabular-nums">{done}</span> done
      </p>
      <ul className="space-y-3">
        {assessments.slice(0, 4).map((a) => (
          <li key={`${a.scope}-${a.id}`}>
            <Link href={a.href} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ws-primary">{a.title}</span>
                <span className="block truncate text-[11px] text-ws-muted">
                  {assessmentKindLabel(a)} · {a.courseTitle}
                </span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", ASSESSMENT_STATUS[a.status].className)}>
                {ASSESSMENT_STATUS[a.status].label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardTile>
  )
}
