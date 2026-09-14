"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, PlusIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { SubmissionFiles } from "@/components/assignments/submission-files"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getCourseAssignments,
  gradeSubmission,
  saveAssignment,
  type InstructorAssignment,
  type InstructorSubmission,
} from "@/lib/actions/assignments"
import { formatDateTime } from "@/lib/dashboard-home"
import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { cn } from "@/lib/utils"

/* Practical assignments for one course (spec §6, D7 v2). "New assignment" is
   the page's one gold CTA; everything else is outline/ghost. */

function AssignmentForm({
  courseId,
  initial,
  onSaved,
  onCancel,
}: {
  courseId: string
  initial: InstructorAssignment | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "")
  const [instructions, setInstructions] = React.useState(initial?.instructions ?? "")
  const [dueLocal, setDueLocal] = React.useState(() => isoToLocalInput(initial?.dueAt))
  const [published, setPublished] = React.useState(initial ? initial.status === "published" : true)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const idBase = initial?.id ?? "new"

  return (
    <form
      className="space-y-4 rounded-lg bg-ws-surface p-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const res = await saveAssignment({
            courseId,
            assignmentId: initial?.id ?? null,
            title,
            instructions,
            dueAt: dueLocal ? localInputToIso(dueLocal) : null,
            published,
          })
          if (res.success) onSaved()
          else setError(res.error)
        })
      }}
    >
      <h2 className="text-sm font-semibold text-ws-primary">{initial ? "Edit assignment" : "New assignment"}</h2>
      <div className="space-y-1.5">
        <Label htmlFor={`title-${idBase}`}>Title</Label>
        <Input id={`title-${idBase}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`instructions-${idBase}`}>Instructions</Label>
        <Textarea
          id={`instructions-${idBase}`}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={5000}
          className="min-h-32"
          placeholder="What to do, what to submit, how it will be assessed"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`due-${idBase}`}>Due (optional)</Label>
          <Input
            id={`due-${idBase}`}
            type="datetime-local"
            value={dueLocal}
            onChange={(e) => setDueLocal(e.target.value)}
            className="w-full min-w-0"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-[13px] text-ws-primary">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 accent-ws-brand"
          />
          Published — students whose package includes assignments see it
        </label>
      </div>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save assignment"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function SubmissionCard({ submission, onGraded }: { submission: InstructorSubmission; onGraded: () => void }) {
  const [grade, setGrade] = React.useState(submission.grade === null ? "" : String(submission.grade))
  const [feedback, setFeedback] = React.useState(submission.feedback)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const graded = submission.status === "graded"

  return (
    <li className="space-y-3 rounded-md bg-ws-sunken p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ws-primary">{submission.studentName}</p>
          <p className="text-[11px] tabular-nums text-ws-muted">Submitted {formatDateTime(submission.submittedAt)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
            graded ? "bg-ws-success/10 text-ws-success" : "bg-ws-warning/10 text-ws-warning"
          )}
        >
          {graded ? `Graded · ${submission.grade}/100` : "Needs grading"}
        </span>
      </div>
      {submission.text && (
        <p className="whitespace-pre-wrap break-words text-[13px] text-ws-primary">{submission.text}</p>
      )}
      <SubmissionFiles submissionId={submission.id} files={submission.files} />
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          const value = Number(grade)
          if (grade.trim() === "" || !Number.isFinite(value)) {
            setError("Enter a grade from 0 to 100")
            return
          }
          startTransition(async () => {
            const res = await gradeSubmission({ submissionId: submission.id, grade: value, feedback })
            if (res.success) onGraded()
            else setError(res.error)
          })
        }}
      >
        <div className="flex items-center gap-2">
          <Label htmlFor={`grade-${submission.id}`} className="text-[12px] text-ws-muted">
            Grade
          </Label>
          <Input
            id={`grade-${submission.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="h-9 w-20 tabular-nums"
          />
          <span className="text-[12px] text-ws-muted">/ 100</span>
        </div>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          maxLength={5000}
          className="min-h-20"
          placeholder="Feedback for the student"
          aria-label={`Feedback for ${submission.studentName}`}
        />
        {error && <p className="text-xs text-ws-danger">{error}</p>}
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Saving…" : graded ? "Update grade" : "Save grade"}
        </Button>
      </form>
    </li>
  )
}

function AssignmentCard({
  courseId,
  assignment,
  onChanged,
}: {
  courseId: string
  assignment: InstructorAssignment
  onChanged: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const graded = assignment.submissions.filter((s) => s.status === "graded").length

  if (editing) {
    return (
      <li>
        <AssignmentForm
          courseId={courseId}
          initial={assignment}
          onSaved={() => {
            setEditing(false)
            onChanged()
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="space-y-3 rounded-lg bg-ws-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words font-display text-base font-semibold text-ws-primary">{assignment.title}</h2>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                assignment.status === "published" ? "bg-ws-success/10 text-ws-success" : "bg-ws-chip text-ws-muted"
              )}
            >
              {assignment.status === "published" ? "Published" : "Draft"}
            </span>
          </div>
          <p className="mt-1 text-[12px] tabular-nums text-ws-muted">
            {assignment.dueAt ? `Due ${formatDateTime(assignment.dueAt)} · ` : ""}
            {assignment.submissions.length} submitted · {graded} graded
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
      <p className="line-clamp-3 whitespace-pre-wrap break-words text-[13px] text-ws-muted">{assignment.instructions}</p>
      {assignment.submissions.length > 0 && (
        <>
          <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Hide submissions" : `Review submissions (${assignment.submissions.length})`}
          </Button>
          {open && (
            <ul className="space-y-2">
              {assignment.submissions.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} onGraded={onChanged} />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}

export default function InstructorAssignmentsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const queryClient = useQueryClient()
  const [creating, setCreating] = React.useState(false)
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.courseAssignments(courseId),
    queryFn: () => getCourseAssignments(courseId),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.courseAssignments(courseId) })

  return (
    <>
      <Topbar
        title="Assignments"
        variant="instructor"
        breadcrumbOverrides={{ [courseId]: data?.courseTitle ?? "Course" }}
      />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <Link
            href={`/instructor/courses/${courseId}`}
            className="inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
          >
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            Back to course
          </Link>
          <PageHeader
            title="Assignments"
            subline={data ? `${data.courseTitle} · practical work for packages that include assignments` : undefined}
            action={
              data && !creating ? (
                <Button onClick={() => setCreating(true)}>
                  <PlusIcon size={16} aria-hidden />
                  New assignment
                </Button>
              ) : undefined
            }
          />

          {isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-ws-surface" />
          ) : !data ? (
            <div className="rounded-lg bg-ws-surface px-6 py-8">
              <p className="text-[15px] font-semibold text-ws-primary">Course not found</p>
            </div>
          ) : (
            <>
              {creating && (
                <AssignmentForm
                  courseId={courseId}
                  initial={null}
                  onSaved={() => {
                    setCreating(false)
                    refresh()
                  }}
                  onCancel={() => setCreating(false)}
                />
              )}
              {data.assignments.length === 0 && !creating ? (
                <div className="rounded-lg bg-ws-surface px-6 py-8">
                  <p className="text-[15px] font-semibold text-ws-primary">No assignments yet</p>
                  <p className="mt-1 text-[13px] text-ws-muted">
                    Published assignments appear on the dashboard of students whose package includes assignments.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {data.assignments.map((assignment) => (
                    <AssignmentCard key={assignment.id} courseId={courseId} assignment={assignment} onChanged={refresh} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
