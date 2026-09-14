"use client"

import Link from "next/link"
import { ClipboardCheckIcon } from "lucide-react"
import { DashboardTile } from "@/components/dashboard/home-tiles"
import type { MyAssessment } from "@/lib/actions/exams"
import { useMyAssessments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

const STATUS: Record<MyAssessment["status"], { label: string; className: string }> = {
  not_started: { label: "Not started", className: "bg-ws-chip text-ws-muted" },
  in_progress: { label: "In progress", className: "bg-ws-warning/10 text-ws-warning" },
  passed: { label: "Passed", className: "bg-ws-success/10 text-ws-success" },
  failed: { label: "Failed", className: "bg-ws-danger/10 text-ws-danger" },
}

/**
 * Spec §12 Assignments (D7 lite): the knowledge checks and final exams the
 * student's packages include, with attempt state. Hidden while loading and when
 * there is nothing to take — a tile with nothing in it would imply work exists.
 */
export function AssignmentsTile() {
  const { data: assessments = [] } = useMyAssessments()
  if (assessments.length === 0) return null

  const passed = assessments.filter((a) => a.status === "passed").length

  return (
    <DashboardTile icon={ClipboardCheckIcon} title="Assignments">
      <p className="mb-3 text-[13px] text-ws-muted">
        <span className="font-semibold tabular-nums text-ws-primary">{assessments.length - passed}</span> to do ·{" "}
        <span className="tabular-nums">{passed}</span> passed
      </p>
      <ul className="space-y-3">
        {assessments.slice(0, 4).map((a) => (
          <li key={a.examId}>
            <Link href={a.href} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ws-primary">{a.title}</span>
                <span className="block truncate text-[11px] text-ws-muted">
                  {a.scope === "final" ? "Final exam" : "Knowledge check"} · {a.courseTitle}
                </span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS[a.status].className)}>
                {STATUS[a.status].label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {assessments.length > 4 && (
        <p className="mt-3 text-[11px] tabular-nums text-ws-muted">+{assessments.length - 4} more in your programs</p>
      )}
    </DashboardTile>
  )
}
