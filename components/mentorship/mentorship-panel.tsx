"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  cancelMentorshipSession,
  confirmMentorshipSession,
  getMentorshipQueue,
  saveMentorRoadmap,
  type MenteeView,
  type MentorshipSessionView,
} from "@/lib/actions/mentorship"
import { formatDateTime } from "@/lib/dashboard-home"
import { queryKeys } from "@/lib/hooks/queries/keys"

/* Executive mentorship on /instructor/meetings: answer requests, see booked
   sessions (they start from Active Meetings below), keep each mentee's roadmap.
   Outline/ghost only — gold stays with the page's own actions. */

type ActionResult = { success: boolean; error?: string }

function useRowAction(onChanged: () => void) {
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (res.success) {
        onSuccess?.()
        onChanged()
      } else {
        setError(res.error ?? "Something went wrong — try again")
      }
    })
  }
  return { error, pending, run }
}

function RequestRow({ session, onChanged }: { session: MentorshipSessionView; onChanged: () => void }) {
  const [declining, setDeclining] = React.useState(false)
  const [note, setNote] = React.useState("")
  const { error, pending, run } = useRowAction(onChanged)

  return (
    <li className="space-y-3 rounded-md bg-ws-sunken p-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ws-primary">{session.studentName}</p>
        <p className="truncate text-[11px] text-ws-muted">{session.courseTitle}</p>
        {session.note && <p className="mt-1 break-words text-[12px] text-ws-muted">“{session.note}”</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {session.proposedSlots.map((slot) => (
          <Button
            key={slot}
            size="sm"
            variant="outline"
            className="tabular-nums"
            disabled={pending}
            onClick={() => run(() => confirmMentorshipSession(session.id, slot))}
          >
            Confirm {formatDateTime(slot)}
          </Button>
        ))}
        {!declining && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDeclining(true)}>
            Decline
          </Button>
        )}
      </div>
      {declining && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Optional note to the student"
            aria-label="Note to the student"
            className="h-9 min-w-0 flex-1 basis-48 text-sm"
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => cancelMentorshipSession(session.id, note))}
          >
            Decline request
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDeclining(false)}>
            Keep
          </Button>
        </div>
      )}
      {pending && <p className="text-[11px] text-ws-muted">Working…</p>}
      {error && <p className="text-xs text-ws-danger">{error}</p>}
    </li>
  )
}

function UpcomingRow({ session, onChanged }: { session: MentorshipSessionView; onChanged: () => void }) {
  const [confirming, setConfirming] = React.useState(false)
  const { error, pending, run } = useRowAction(onChanged)

  return (
    <li className="space-y-2 rounded-md bg-ws-sunken p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ws-primary">
            {session.studentName} <span className="font-normal text-ws-muted">· {session.courseTitle}</span>
          </p>
          <p className="text-[11px] tabular-nums text-ws-muted">
            {session.scheduledAt ? formatDateTime(session.scheduledAt) : ""}
            {session.lapsed ? "" : " · start it from Active Meetings"}
          </p>
          {session.lapsed && <p className="text-[11px] text-ws-warning">Student no longer has mentorship</p>}
        </div>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => cancelMentorshipSession(session.id))}
            >
              {pending ? "Cancelling…" : "Cancel session"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Cancel
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
    </li>
  )
}

function MenteeRow({ mentee, onChanged }: { mentee: MenteeView; onChanged: () => void }) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(mentee.roadmap?.text ?? "")
  const { error, pending, run } = useRowAction(onChanged)

  return (
    <li className="space-y-2 rounded-md bg-ws-sunken p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ws-primary">{mentee.studentName}</p>
          <p className="truncate text-[11px] text-ws-muted">{mentee.courseTitle}</p>
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setText(mentee.roadmap?.text ?? "")
              setEditing(true)
            }}
          >
            {mentee.roadmap ? "Edit roadmap" : "Write roadmap"}
          </Button>
        )}
      </div>
      {mentee.intake && (
        <p className="break-words text-[12px] text-ws-muted">
          <span className="text-ws-subtle">Goals</span> · {mentee.intake.goals}{" "}
          <span className="text-ws-subtle">· Availability</span> · {mentee.intake.availability}
        </p>
      )}
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
            className="min-h-32"
            aria-label={`Roadmap for ${mentee.studentName}`}
            placeholder="Milestones, focus areas and what to practise before the next session"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => saveMentorRoadmap(mentee.enrollmentId, text), () => setEditing(false))}
            >
              {pending ? "Saving…" : "Save roadmap"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <span className="ml-auto text-[11px] tabular-nums text-ws-subtle">{text.length}/5000</span>
          </div>
        </div>
      ) : mentee.roadmap ? (
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-[12px] text-ws-primary">{mentee.roadmap.text}</p>
      ) : (
        <p className="text-[12px] text-ws-muted">No roadmap yet.</p>
      )}
      {error && <p className="text-xs text-ws-danger">{error}</p>}
    </li>
  )
}

export function MentorshipPanel() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: queryKeys.mentorshipQueue,
    queryFn: () => getMentorshipQueue(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
  const requests = data?.requests ?? []
  const upcoming = data?.upcoming ?? []
  const mentees = data?.mentees ?? []
  if (requests.length + upcoming.length + mentees.length === 0) return null

  // A confirmation creates a scheduled meeting in Active Meetings; refresh both.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mentorshipQueue })
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings })
  }

  return (
    <section id="mentorship" className="space-y-4 rounded-lg bg-ws-surface p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ws-primary">Mentorship</h2>
        <span className="text-[11px] tabular-nums text-ws-muted">
          {requests.length} to answer · {upcoming.length} upcoming · {mentees.length} mentee{mentees.length === 1 ? "" : "s"}
        </span>
      </div>
      {requests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Requests</h3>
          <ul className="space-y-2">
            {requests.map((session) => (
              <RequestRow key={session.id} session={session} onChanged={refresh} />
            ))}
          </ul>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Upcoming sessions</h3>
          <ul className="space-y-2">
            {upcoming.map((session) => (
              <UpcomingRow key={session.id} session={session} onChanged={refresh} />
            ))}
          </ul>
        </div>
      )}
      {mentees.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Mentees</h3>
          <ul className="space-y-2">
            {mentees.map((mentee) => (
              <MenteeRow key={mentee.enrollmentId} mentee={mentee} onChanged={refresh} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
