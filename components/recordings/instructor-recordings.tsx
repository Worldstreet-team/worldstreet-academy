"use client"
import { EyeIcon, EyeOffIcon, PencilIcon, PlayIcon } from "@/components/icons"

import { useState, useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  listInstructorRecordings,
  renameRecording,
  setRecordingHidden,
  type InstructorRecordingView,
} from "@/lib/actions/recordings"
import { formatRecordedAt, formatRecordingDuration } from "@/components/recordings/recordings-list"
import { cn } from "@/lib/utils"

export const INSTRUCTOR_RECORDINGS_KEY = ["instructor-recordings"] as const

const STATUS: Record<InstructorRecordingView["status"], { label: string; className: string }> = {
  pending: { label: "Processing", className: "bg-ws-chip text-ws-muted" },
  stored: { label: "Ready", className: "bg-ws-success/10 text-ws-success" },
  failed: { label: "Not saved", className: "bg-ws-danger/10 text-ws-danger" },
}

function RecordingRow({
  rec,
  onPlay,
  onChanged,
}: {
  rec: InstructorRecordingView
  onPlay: () => void
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(rec.title)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const status = STATUS[rec.status]

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await renameRecording({ recordingId: rec.id, title })
      if (res.success) {
        setEditing(false)
        onChanged()
      } else setError(res.error)
    })
  }

  function toggleHidden() {
    setError(null)
    startTransition(async () => {
      const res = await setRecordingHidden({ recordingId: rec.id, hidden: !rec.hidden })
      if (res.success) onChanged()
      else setError(res.error)
    })
  }

  return (
    <li className="rounded-md bg-ws-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                save()
              }}
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                aria-label="Recording title"
                className="h-8"
                autoFocus
              />
              <Button type="submit" size="sm" variant="outline" disabled={pending}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setTitle(rec.title)
                  setEditing(false)
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <p className="truncate text-[14px] font-medium text-ws-primary">{rec.title}</p>
          )}
          <p className="mt-0.5 truncate text-[12px] text-ws-muted">
            {[rec.courseTitle, formatRecordedAt(rec.recordedAt), formatRecordingDuration(rec.durationSeconds)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {rec.hidden && (
            <span className="rounded-full bg-ws-chip px-2 py-0.5 text-[10px] font-semibold text-ws-muted">Hidden</span>
          )}
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", status.className)}>
            {status.label}
          </span>
          {rec.status === "stored" && (
            <Button size="icon-sm" variant="ghost" onClick={onPlay} aria-label={`Watch ${rec.title}`} title="Watch">
              <PlayIcon size={14} />
            </Button>
          )}
          {!editing && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              aria-label={`Rename ${rec.title}`}
              title="Rename"
            >
              <PencilIcon size={14} />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={toggleHidden}
            disabled={pending}
            aria-label={rec.hidden ? `Show ${rec.title} to students` : `Hide ${rec.title} from students`}
            title={rec.hidden ? "Show to students" : "Hide from students"}
          >
            {rec.hidden ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
          </Button>
        </div>
      </div>
      {rec.status === "failed" && rec.failureReason && (
        <p className="mt-1.5 text-[12px] text-ws-muted">{rec.failureReason}</p>
      )}
      {error && <p className="mt-1.5 text-[12px] text-ws-danger">{error}</p>}
    </li>
  )
}

/**
 * The tutor's class recordings — every status, hidden ones too. Rename or
 * hide from students; play the stored ones. Classes record automatically;
 * mentorship sessions never do.
 */
export function InstructorRecordings({ onPlay }: { onPlay: (rec: { id: string; title: string }) => void }) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: INSTRUCTOR_RECORDINGS_KEY,
    queryFn: () => listInstructorRecordings(),
  })
  const recordings = data?.success ? data.data : []

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: INSTRUCTOR_RECORDINGS_KEY })
    void queryClient.invalidateQueries({ queryKey: ["teaching-calendar"] })
    void queryClient.invalidateQueries({ queryKey: ["recordings"] })
  }

  return (
    <section className="space-y-3" id="recordings">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ws-primary">Class recordings</h2>
        <span className="text-[11px] text-ws-muted">Students can watch, not download</span>
      </div>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-ws-surface motion-reduce:animate-none" />
      ) : data && !data.success ? (
        <p className="rounded-lg bg-ws-surface px-4 py-6 text-sm text-ws-muted">{data.error}</p>
      ) : recordings.length === 0 ? (
        <p className="rounded-lg bg-ws-surface px-4 py-6 text-sm text-ws-muted">
          Every live class is recorded. Recordings appear here within about an hour of the class ending.
        </p>
      ) : (
        <ul className="space-y-2">
          {recordings.map((rec) => (
            <RecordingRow
              key={`${rec.id}-${rec.title}-${rec.hidden}`}
              rec={rec}
              onPlay={() => onPlay(rec)}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
