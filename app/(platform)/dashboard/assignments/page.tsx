"use client"

import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { ASSESSMENT_STATUS, assessmentKindLabel } from "@/components/dashboard/assignments-tile"
import { CardShell, EmptyState } from "@/components/ui/system"
import { useMyAssessments } from "@/lib/hooks/queries"
import { cn } from "@/lib/utils"

/** Every row behind the dashboard's Assignments tile. */
export default function AssignmentsPage() {
  const { data: assessments = [], isLoading, isError, refetch } = useMyAssessments()

  return (
    <>
      <Topbar title="Assignments" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <PageHeader
            title="Assignments"
            subline="Knowledge checks, final exams and practical assignments your packages include."
          />
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-ws-surface" />
          ) : isError ? (
            <CardShell>
              <EmptyState
                title="Couldn't load this"
                description="Check your connection and try again."
                ctas={[{ label: "Try again", onClick: () => refetch() }]}
              />
            </CardShell>
          ) : assessments.length === 0 ? (
            <div className="rounded-lg bg-ws-surface px-6 py-8">
              <p className="text-[15px] font-semibold text-ws-primary">Nothing to take or submit right now</p>
              <p className="mt-1 text-[13px] text-ws-muted">
                Assessments and assignments from your programs appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {assessments.map((a) => (
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
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        ASSESSMENT_STATUS[a.status].className
                      )}
                    >
                      {ASSESSMENT_STATUS[a.status].label}
                    </span>
                    <ChevronRightIcon size={14} className="shrink-0 text-ws-subtle" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
