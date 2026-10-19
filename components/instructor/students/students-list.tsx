import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CardShell, EmptyState } from "@/components/ui/system"
import type { FacultyStudentRow, FacultyStudentsView } from "@/lib/actions/faculty-students"
import { shortDate } from "@/lib/faculty-format"
import { assignmentsLabel } from "@/lib/faculty-students"

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 w-20 overflow-hidden rounded-full bg-ws-chip" aria-hidden>
        <span className="block h-full rounded-full bg-ws-muted" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </span>
      <span className="text-[12px] tabular-nums text-muted-foreground">{`${value}%`}</span>
    </span>
  )
}

function LearnerCell({ row }: { row: FacultyStudentRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm">
        {row.learner.avatarUrl && <AvatarImage src={row.learner.avatarUrl} alt="" />}
        <AvatarFallback>{initials(row.learner.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate font-medium">{row.learner.name}</span>
    </span>
  )
}

const lastActive = (iso: string | null) => (iso ? shortDate(iso) : "Never")

/** The table (lg and up) and the stacked cards (below) over the same rows. */
export function StudentsList({ view, filtered }: { view: FacultyStudentsView; filtered: boolean }) {
  if (view.programs.length === 0) {
    return (
      <CardShell>
        <EmptyState
          title="You don't teach a program yet"
          description="Learners appear here once they enrol in one of your programs."
          ctas={[{ label: "Create a program", href: "/instructor/courses/new" }]}
        />
      </CardShell>
    )
  }
  if (view.rows.length === 0) {
    return (
      <CardShell>
        {filtered ? (
          <EmptyState
            title="No learners match these filters"
            ctas={[{ label: "Clear filters", href: "/instructor/students" }]}
          />
        ) : (
          <EmptyState title="No learners yet" description="Active and completed learners in your programs appear here." />
        )}
      </CardShell>
    )
  }

  const cohortCol = view.cohorts.length > 0
  const heads = [
    "Learner",
    "Program",
    "Plan",
    ...(cohortCol ? ["Cohort"] : []),
    "Progress",
    "Last active",
    "Best exam",
    "Assignments",
    ...(view.masteryReady ? ["Attendance", "Mastery Score"] : []),
  ]

  return (
    <CardShell>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-[13px]">
          <thead className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              {heads.map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {view.rows.map((r) => (
              <tr key={r.enrollmentId}>
                <td className="max-w-[16rem] px-4 py-3">
                  <Link
                    href={`/instructor/students/${r.enrollmentId}`}
                    className="rounded-sm hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <LearnerCell row={r} />
                  </Link>
                </td>
                <td className="max-w-[14rem] truncate px-4 py-3">{r.program.title}</td>
                <td className="whitespace-nowrap px-4 py-3">{r.plan.label}</td>
                {cohortCol && <td className="whitespace-nowrap px-4 py-3">{r.cohort?.name ?? "—"}</td>}
                <td className="px-4 py-3">
                  <ProgressBar value={r.progress} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{lastActive(r.lastActiveAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {r.bestExam ? (
                    <>
                      {`${r.bestExam.percent}%`}
                      {r.bestExam.passed && <span className="ml-1.5 text-ws-success">Passed</span>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">{assignmentsLabel(r.assignments.graded, r.assignments.average)}</td>
                {view.masteryReady && (
                  <>
                    <td className="px-4 py-3 tabular-nums">{r.attendance === null ? "—" : `${r.attendance}%`}</td>
                    <td className="px-4 py-3 tabular-nums">{r.mastery === null ? "—" : r.mastery}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border lg:hidden">
        {view.rows.map((r) => (
          <li key={r.enrollmentId}>
            <Link
              href={`/instructor/students/${r.enrollmentId}`}
              className="block px-5 py-3.5 transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <p className="truncate text-[14px] font-medium">{r.learner.name}</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {r.program.title} · {r.plan.label}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <ProgressBar value={r.progress} />
                <span className="text-[12px] tabular-nums text-muted-foreground">{lastActive(r.lastActiveAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </CardShell>
  )
}
