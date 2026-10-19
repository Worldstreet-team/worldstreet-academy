import Link from "next/link"

import { initials, ProgressBar } from "@/components/instructor/students/students-list"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CardHeader, CardShell } from "@/components/ui/system"
import type { FacultyStudentRow, PerformanceOverview } from "@/lib/actions/faculty-students"
import { shortDate } from "@/lib/faculty-format"
import {
  ATTENTION_LABEL,
  NEEDS_ATTENTION_RULE,
  studentsHref,
  type AttentionReason,
  type FacultyStudentFilters,
  type ProgramSummary,
} from "@/lib/faculty-students"

/*
 * Student Performance across learners (institutional blueprint §16): a card
 * per program, then every learner ranked, needs-attention first. Each learner
 * opens their own Student Performance page.
 */

const CHIP = "rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
const percent = (v: number | null) => (v === null ? "—" : `${v}%`)

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="font-display text-[20px] font-semibold tabular-nums">
        {value}
        {hint && <span className="ml-1.5 font-sans text-[12px] font-normal text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  )
}

export function ProgramSummaryCard({
  summary: s,
  masteryReady,
  filters,
}: {
  summary: ProgramSummary
  masteryReady: boolean
  filters: FacultyStudentFilters
}) {
  return (
    <CardShell className="h-auto">
      <CardHeader
        title={s.title}
        subtitle={s.learners === 1 ? "1 learner" : `${s.learners} learners`}
        link={{ label: "Learners", href: studentsHref({ ...filters, program: s.id }) }}
      />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-4 py-3.5">
        <Stat label="Average progress" value={percent(s.avgProgress)} />
        {masteryReady && <Stat label="Mastery Score" value={s.avgMastery === null ? "—" : String(s.avgMastery)} />}
        <Stat
          label="Exam pass rate"
          value={percent(s.examPassRate)}
          hint={s.examTakers > 0 ? `of ${s.examTakers}` : undefined}
        />
        {masteryReady && <Stat label="Attendance" value={percent(s.avgAttendance)} />}
      </dl>
    </CardShell>
  )
}

function LearnerRow({
  row,
  reasons,
  masteryReady,
}: {
  row: FacultyStudentRow
  reasons?: AttentionReason[]
  masteryReady: boolean
}) {
  const meta = [
    row.program.title,
    row.plan.label,
    row.cohort?.name,
    `Last active ${row.lastActiveAt ? shortDate(row.lastActiveAt) : "never"}`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <li>
      <Link
        href={`/instructor/students/${row.enrollmentId}`}
        className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar size="sm">
            {row.learner.avatarUrl && <AvatarImage src={row.learner.avatarUrl} alt="" />}
            <AvatarFallback>{initials(row.learner.name)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-medium">{row.learner.name}</span>
            <span className="truncate text-[12px] text-muted-foreground">{meta}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 sm:justify-end">
          {reasons && reasons.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <span key={r} className={`${CHIP} bg-ws-warning/10 text-ws-warning`}>
                  {ATTENTION_LABEL[r]}
                </span>
              ))}
            </span>
          )}
          <ProgressBar value={row.progress} />
          {masteryReady && (
            <span className="text-[12px] tabular-nums text-muted-foreground">
              Mastery <span className="font-semibold text-foreground">{row.mastery ?? "—"}</span>
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

export function PerformanceLists({ view }: { view: PerformanceOverview }) {
  return (
    <>
      <CardShell className="h-auto">
        <CardHeader
          title="Needs attention"
          subtitle={NEEDS_ATTENTION_RULE}
          badge={
            <span className={`${CHIP} tabular-nums ${view.attention.length ? "bg-ws-warning/10 text-ws-warning" : "bg-ws-chip text-muted-foreground"}`}>
              {view.attention.length}
            </span>
          }
        />
        {view.attention.length === 0 ? (
          <p className="border-t border-border px-4 py-3.5 text-[13px] text-muted-foreground sm:px-5">
            No one needs attention right now.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {view.attention.map((r) => (
              <LearnerRow key={r.enrollmentId} row={r} reasons={r.reasons} masteryReady={view.masteryReady} />
            ))}
          </ul>
        )}
      </CardShell>

      {view.rest.length > 0 && (
        <CardShell className="h-auto">
          <CardHeader
            title={view.attention.length ? "Everyone else" : "All learners"}
            subtitle={view.masteryReady ? "Ranked by Mastery Score, then progress" : "Ranked by progress"}
          />
          <ul className="divide-y divide-border border-t border-border">
            {view.rest.map((r) => (
              <LearnerRow key={r.enrollmentId} row={r} masteryReady={view.masteryReady} />
            ))}
          </ul>
        </CardShell>
      )}
    </>
  )
}
