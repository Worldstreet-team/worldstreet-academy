"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, PaperclipIcon, XIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { SubmissionFiles, formatSize } from "@/components/assignments/submission-files"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getAssignmentForStudent,
  getSubmissionUploadUrl,
  submitAssignment,
  type StudentAssignment,
  type StudentSubmissionFile,
} from "@/lib/actions/assignments"
import { formatDateTime } from "@/lib/dashboard-home"
import { queryKeys } from "@/lib/hooks/queries/keys"

/* One practical assignment: instructions, submit/resubmit until graded, then the
   grade and feedback. "Submit assignment" is the page's one gold CTA. */

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.png,.jpg,.jpeg"
const MAX_FILES = 3
const MAX_BYTES = 25 * 1024 * 1024

type UploadedFile = { key: string; filename: string; mimeType: string; sizeBytes: number }

function SubmissionForm({ assignment, onSubmitted }: { assignment: StudentAssignment; onSubmitted: () => void }) {
  const existing = assignment.submission
  const [text, setText] = React.useState(existing?.text ?? "")
  const [kept, setKept] = React.useState<StudentSubmissionFile[]>(existing?.files ?? [])
  const [added, setAdded] = React.useState<File[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const room = MAX_FILES - kept.length - added.length

  function addFiles(list: FileList | null) {
    if (!list) return
    setError(null)
    const next = [...added]
    for (const file of Array.from(list)) {
      if (kept.length + next.length >= MAX_FILES) {
        setError("Attach up to three files")
        break
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is over 25 MB`)
        continue
      }
      next.push(file)
    }
    setAdded(next)
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          // Straight to the private bucket; the submission is written only after every upload succeeded.
          const uploaded: UploadedFile[] = []
          for (const file of added) {
            setProgress(`Uploading ${file.name}…`)
            const presign = await getSubmissionUploadUrl(assignment.id, file.name, file.type, file.size)
            if (!presign.success) {
              setProgress(null)
              setError(presign.error)
              return
            }
            const put = await fetch(presign.data.uploadUrl, {
              method: "PUT",
              body: file,
              headers: { "Content-Type": file.type },
            })
            if (!put.ok) {
              setProgress(null)
              setError(`Couldn't upload ${file.name} — try again`)
              return
            }
            uploaded.push({ key: presign.data.storageKey, filename: file.name, mimeType: file.type, sizeBytes: file.size })
          }
          setProgress("Submitting…")
          const res = await submitAssignment({
            assignmentId: assignment.id,
            text,
            files: [
              ...kept.map(({ key, filename, mimeType, sizeBytes }) => ({ key, filename, mimeType, sizeBytes })),
              ...uploaded,
            ],
          })
          setProgress(null)
          if (res.success) {
            setAdded([])
            onSubmitted()
          } else {
            setError(res.error)
          }
        })
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="submission-text">Your answer</Label>
        <Textarea
          id="submission-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={10000}
          className="min-h-40"
          placeholder="Write your answer, or attach your work below"
        />
      </div>

      <div className="space-y-2">
        {(kept.length > 0 || added.length > 0) && (
          <ul className="space-y-1.5">
            {kept.map((file) => (
              <li key={file.key} className="flex items-center gap-2 rounded-sm bg-ws-sunken px-3 py-2 text-[13px]">
                <PaperclipIcon size={13} className="shrink-0 text-ws-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ws-primary">{file.filename}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-ws-muted">{formatSize(file.sizeBytes)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.filename}`}
                  onClick={() => setKept((prev) => prev.filter((f) => f.key !== file.key))}
                  className="shrink-0 text-ws-muted transition-colors hover:text-ws-primary"
                >
                  <XIcon size={14} aria-hidden />
                </button>
              </li>
            ))}
            {added.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-sm bg-ws-sunken px-3 py-2 text-[13px]">
                <PaperclipIcon size={13} className="shrink-0 text-ws-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ws-primary">{file.name}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-ws-muted">{formatSize(file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setAdded((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 text-ws-muted transition-colors hover:text-ws-primary"
                >
                  <XIcon size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          aria-label="Attach files"
          onChange={(e) => addFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={room <= 0 || pending}
            onClick={() => fileRef.current?.click()}
          >
            <PaperclipIcon size={14} aria-hidden />
            Attach files
          </Button>
          <p className="text-[11px] text-ws-muted">
            Up to 3 files, 25 MB each. Only you, your instructor and admins can open them.
          </p>
        </div>
      </div>

      {progress && <p className="text-[12px] text-ws-muted">{progress}</p>}
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : existing ? "Resubmit" : "Submit assignment"}
      </Button>
    </form>
  )
}

export default function AssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.studentAssignment(assignmentId),
    queryFn: () => getAssignmentForStudent(assignmentId),
  })
  const assignment = data?.success ? data.data : null
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.studentAssignment(assignmentId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.assessments })
  }

  return (
    <>
      <Topbar title="Assignment" breadcrumbOverrides={{ [assignmentId]: assignment?.title ?? "Assignment" }} />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <Link
            href="/dashboard/assignments"
            className="inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
          >
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            All assignments
          </Link>

          {isLoading ? (
            <div className="h-48 animate-pulse rounded-lg bg-ws-surface" />
          ) : !assignment ? (
            <div className="rounded-lg bg-ws-surface px-6 py-8">
              <p className="text-[15px] font-semibold text-ws-primary">
                {data && !data.success ? data.error : "Assignment not found"}
              </p>
            </div>
          ) : (
            <>
              <header className="min-w-0 space-y-1">
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">
                  {assignment.courseTitle}
                </p>
                <h1 className="break-words font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
                  {assignment.title}
                </h1>
                {assignment.dueAt && (
                  <p className="text-[13px] tabular-nums text-ws-muted">Due {formatDateTime(assignment.dueAt)}</p>
                )}
              </header>

              <section className="rounded-lg bg-ws-surface p-5">
                <h2 className="text-sm font-semibold text-ws-primary">Instructions</h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ws-primary">
                  {assignment.instructions}
                </p>
              </section>

              {assignment.submission?.status === "graded" ? (
                <section className="space-y-4 rounded-lg bg-ws-surface p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-semibold text-ws-primary">Your grade</h2>
                    <p className="font-display text-3xl font-light tabular-nums text-ws-primary">
                      {assignment.submission.grade}
                      <span className="ml-1 font-sans text-[13px] font-normal text-ws-muted">/ 100</span>
                    </p>
                  </div>
                  {assignment.submission.feedback && (
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ws-primary">
                      {assignment.submission.feedback}
                    </p>
                  )}
                  <div className="space-y-2 rounded-md bg-ws-sunken p-4">
                    <p className="text-[11px] tabular-nums text-ws-muted">
                      Submitted {formatDateTime(assignment.submission.submittedAt)}
                    </p>
                    {assignment.submission.text && (
                      <p className="whitespace-pre-wrap break-words text-[13px] text-ws-primary">
                        {assignment.submission.text}
                      </p>
                    )}
                    <SubmissionFiles submissionId={assignment.submission.id} files={assignment.submission.files} />
                  </div>
                </section>
              ) : (
                <section className="space-y-4 rounded-lg bg-ws-surface p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-ws-primary">
                      {assignment.submission ? "Your submission" : "Submit your work"}
                    </h2>
                    {assignment.submission && (
                      <p className="text-[11px] tabular-nums text-ws-muted">
                        Submitted {formatDateTime(assignment.submission.submittedAt)} · you can resubmit until it&apos;s graded
                      </p>
                    )}
                  </div>
                  {assignment.submission && assignment.submission.files.length > 0 && (
                    <SubmissionFiles submissionId={assignment.submission.id} files={assignment.submission.files} />
                  )}
                  <SubmissionForm
                    key={assignment.submission?.submittedAt ?? "new"}
                    assignment={assignment}
                    onSubmitted={refresh}
                  />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
