import Link from "next/link"
import { notFound } from "next/navigation"

import { CircleCheckBigIcon, LockIcon } from "@/components/icons"
import { ClassesList } from "@/components/instructor/students/classes-list"
import { Topbar } from "@/components/platform/topbar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BackAction, CardHeader, CardShell, EmptyState } from "@/components/ui/system"
import { getStudentPerformance, type StudentPerformance } from "@/lib/actions/faculty-students"
import { shortDate } from "@/lib/faculty-format"
import { ENROLLMENT_STATUS_LABEL } from "@/lib/faculty-students"

const PART_LABEL = {
  completion: "Completion",
  assessment: "Assessments",
  assignments: "Assignments",
  projects: "Projects",
  attendance: "Attendance",
} as const

const CHIP = "rounded-full bg-ws-chip px-2.5 py-0.5 text-[12px] font-semibold"

function sectionsOf(lessons: StudentPerformance["lessons"]) {
  const groups: { section: string | null; items: StudentPerformance["lessons"] }[] = []
  for (const l of lessons) {
    const last = groups[groups.length - 1]
    if (last && last.section === l.section) last.items.push(l)
    else groups.push({ section: l.section, items: [l] })
  }
  return groups
}

function attemptStatus(s: StudentPerformance["exam"]["attempts"][number]["status"]): string {
  return s === "passed" ? "Passed" : s === "failed" ? "Not passed" : s === "expired" ? "Expired" : "Submitted"
}

export default async function StudentPerformancePage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params
  const result = await getStudentPerformance(enrollmentId)
  if (!result.success) {
    if (result.code === "not_found") notFound()
    return (
      <>
        <Topbar title="Student" variant="instructor" />
        <div className="flex-1 px-4 pt-8 sm:px-6 md:px-8 lg:px-12">
          <CardShell>
            <EmptyState title="Could not load this learner" description={result.error} />
          </CardShell>
        </div>
      </>
    )
  }
  const d = result.data
  const completedCount = d.lessons.filter((l) => l.completed).length
  const initials =
    d.learner.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"

  return (
    <>
      <Topbar title="Student" variant="instructor" breadcrumbOverrides={{ [enrollmentId]: d.learner.name }} />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="flex items-start gap-3">
            <BackAction to="/instructor/students" />
            <Avatar size="lg">
              {d.learner.avatarUrl && <AvatarImage src={d.learner.avatarUrl} alt="" />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="font-display text-[28px] font-bold leading-[1.15] tracking-[-0.02em] break-words">
                {d.learner.name}
              </h1>
              <div className="flex flex-wrap gap-1.5">
                <Link href={d.program.manageHref} className={`${CHIP} hover:bg-ws-raised`}>
                  {d.program.title}
                </Link>
                <span className={CHIP}>{d.plan.label}</span>
                <span className={CHIP}>{ENROLLMENT_STATUS_LABEL[d.status]}</span>
                {d.cohort && <span className={CHIP}>{d.cohort.name}</span>}
              </div>
              <p className="text-[13px] text-muted-foreground">
                Enrolled {shortDate(d.enrolledAt)} · Last active {d.lastActiveAt ? shortDate(d.lastActiveAt) : "Never"}
              </p>
              <div className="flex items-center gap-2">
                <span className="h-1 w-40 max-w-full overflow-hidden rounded-full bg-ws-chip" aria-hidden>
                  <span className="block h-full rounded-full bg-ws-muted" style={{ width: `${Math.min(100, Math.max(0, d.progress))}%` }} />
                </span>
                <span className="text-[12px] tabular-nums text-muted-foreground">{`${d.progress}%`}</span>
              </div>
            </div>
          </div>

          <CardShell>
            <CardHeader title="Lessons" subtitle={`${completedCount} of ${d.lessons.length} completed`} />
            {d.lessons.length === 0 ? (
              <p className="px-4 pb-4 text-[13px] text-muted-foreground">No published lessons yet</p>
            ) : (
              <div className="pb-2">
                {sectionsOf(d.lessons).map((g, i) => (
                  <div key={`${g.section ?? "none"}-${i}`}>
                    {g.section && (
                      <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {g.section}
                      </p>
                    )}
                    <ul className="divide-y divide-border">
                      {g.items.map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                          <span className="min-w-0 truncate font-medium">{l.title}</span>
                          {l.completed ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-ws-success">
                              <CircleCheckBigIcon size={14} aria-hidden />
                              Completed
                            </span>
                          ) : l.locked ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                              <LockIcon size={14} aria-hidden />
                              Locked by plan
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardShell>

          <CardShell>
            <CardHeader title="Exams" subtitle={d.exam.passMark !== null ? `Pass mark ${d.exam.passMark}%` : undefined} />
            {d.exam.attempts.length === 0 ? (
              <p className="px-4 pb-4 text-[13px] text-muted-foreground">No attempts yet</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.exam.attempts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.title}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {a.scope === "final" ? "Final exam" : "Lesson quiz"} · Attempt {a.attemptNumber}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="font-semibold tabular-nums">
                        {a.scorePercent === null ? "—" : `${a.scorePercent}%`}
                      </span>
                      <span className={CHIP}>{attemptStatus(a.status)}</span>
                      <span className="tabular-nums text-muted-foreground">{shortDate(a.at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardShell>

          <CardShell>
            <CardHeader
              title="Assignments"
              link={{ label: "Grade submissions", href: `/instructor/courses/${d.program.id}/assignments` }}
            />
            {d.assignments.length === 0 ? (
              <p className="px-4 pb-4 text-[13px] text-muted-foreground">No published assignments</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.assignments.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-[13px]">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                      <span className="min-w-0 font-medium break-words">{a.title}</span>
                      {a.dueAt && <span className="text-[12px] tabular-nums text-muted-foreground">Due {shortDate(a.dueAt)}</span>}
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      {!a.submission
                        ? "Not submitted"
                        : a.submission.status === "graded"
                          ? `Graded ${a.submission.grade} · ${shortDate(a.submission.gradedAt ?? a.submission.submittedAt)}`
                          : `Submitted ${shortDate(a.submission.submittedAt)} · waiting for a grade`}
                    </p>
                    {a.submission?.status === "graded" && a.submission.feedback && (
                      <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{a.submission.feedback}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardShell>

          <CardShell>
            <CardHeader title="Classes" />
            <ClassesList classes={d.classes} />
          </CardShell>

          {d.mastery && (
            <CardShell>
              <CardHeader title="Mastery Score" />
              <div className="px-4 pb-4">
                <p className="font-display text-[32px] font-bold tabular-nums">
                  {d.mastery.score === null ? "—" : `${d.mastery.score} / 100`}
                </p>
                <ul className="mt-2 divide-y divide-border">
                  {d.mastery.parts.map((p) => (
                    <li key={p.key} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                      <span className="font-medium">{PART_LABEL[p.key]}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {p.value === null ? "—" : p.value} · weight {p.weight}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardShell>
          )}

          {d.mentorship && (
            <CardShell>
              <CardHeader
                title="Mentorship"
                subtitle={d.mentorship.updatedAt ? `Updated ${shortDate(d.mentorship.updatedAt)}` : undefined}
                link={{ label: "Open mentorship", href: d.mentorship.href }}
              />
              <p className="px-4 pb-4 text-[13px] whitespace-pre-line break-words">
                {d.mentorship.roadmap ?? <span className="text-muted-foreground">No roadmap yet</span>}
              </p>
            </CardShell>
          )}
        </div>
      </div>
    </>
  )
}
