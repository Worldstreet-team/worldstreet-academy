"use client"
import { ChevronRightIcon } from "@/components/icons"

import Link from "next/link"

import { ASSESSMENT_STATUS, assessmentKindLabel } from "@/components/dashboard/assignments-tile"
import { CardShell, EmptyState } from "@/components/ui/system"
import { assessmentAction, assessmentKindOf, assessmentMeta, type AssessmentKind } from "@/lib/dashboard-home"
import { useMyAssessments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

const EMPTY: Record<AssessmentKind, { title: string; body: string }> = {
  assessments: {
    title: "No assessments right now",
    body: "Knowledge checks and final exams your plan includes appear here.",
  },
  assignments: {
    title: "Nothing to hand in right now",
    body: "Practical assignments your plan includes appear here.",
  },
}

/** The one list behind /dashboard/assessments (finals and knowledge checks) and /dashboard/assignments (practical work). */
export function AssessmentList({ kind }: { kind: AssessmentKind }) {
  const { data = [], isLoading, isError, refetch } = useMyAssessments()
  const assessments = data.filter((a) => assessmentKindOf(a) === kind)

  if (isLoading) return <div className="h-40 animate-pulse rounded-lg bg-ws-surface" />
  if (isError) {
    return (
      <CardShell>
        <EmptyState
          title="Couldn't load this"
          description="Check your connection and try again."
          ctas={[{ label: "Try again", onClick: () => refetch() }]}
        />
      </CardShell>
    )
  }
  if (assessments.length === 0) {
    return (
      <div className="rounded-lg bg-ws-surface px-6 py-8">
        <p className="text-[15px] font-semibold text-ws-primary">{EMPTY[kind].title}</p>
        <p className="mt-1 text-[13px] text-ws-muted">{EMPTY[kind].body}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {assessments.map((a) => {
        const meta = assessmentMeta(a)
        const action = assessmentAction(a)
        return (
          <li key={`${a.scope}-${a.id}`}>
            <Link
              href={a.href}
              className="flex items-center gap-3 rounded-md bg-ws-surface p-4 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ws-primary">{a.title}</span>
                <span className="block truncate text-[12px] text-ws-muted">
                  {assessmentKindLabel(a)} · {a.courseTitle}
                </span>
                {meta && <span className="block truncate text-[12px] tabular-nums text-ws-muted">{meta}</span>}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  ASSESSMENT_STATUS[a.status].className
                )}
              >
                {ASSESSMENT_STATUS[a.status].label}
              </span>
              {action && (
                <span className="shrink-0 text-[12.5px] font-medium text-ws-primary max-sm:hidden">{action}</span>
              )}
              <ChevronRightIcon size={14} className="shrink-0 text-ws-subtle" aria-hidden />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
