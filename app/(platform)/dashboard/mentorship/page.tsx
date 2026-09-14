"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClockIcon, CompassIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  cancelMentorshipSession,
  getMyMentorship,
  requestMentorshipSession,
  type MentorshipProgram,
  type MentorshipSessionView,
} from "@/lib/actions/mentorship"
import { formatDateTime } from "@/lib/dashboard-home"
import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { cn } from "@/lib/utils"

/* Spec §6 Executive: private 1-on-1 sessions and the personal roadmap. No gold
   on this page — its actions are secondary to the dashboard's Continue learning. */

const SESSION_STATUS: Record<MentorshipSessionView["status"], { label: string; className: string }> = {
  requested: { label: "Waiting for your mentor", className: "bg-ws-warning/10 text-ws-warning" },
  upcoming: { label: "Confirmed", className: "bg-ws-success/10 text-ws-success" },
  past: { label: "Past", className: "bg-ws-chip text-ws-muted" },
  declined: { label: "Declined", className: "bg-ws-chip text-ws-muted" },
  cancelled: { label: "Cancelled", className: "bg-ws-chip text-ws-muted" },
}

function RequestForm({ program, onSent }: { program: MentorshipProgram; onSent: () => void }) {
  const [slots, setSlots] = React.useState(["", "", ""])
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  // Earliest pickable time, an hour out, in the viewer's timezone. The form only
  // mounts after the query resolves in the browser, so this never server-renders.
  const [minLocal] = React.useState(() => isoToLocalInput(new Date(Date.now() + 60 * 60_000).toISOString()))

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        const picked = slots.map((value) => localInputToIso(value)).filter((iso) => iso !== "")
        if (picked.length === 0) {
          setError("Propose at least one time")
          return
        }
        startTransition(async () => {
          const res = await requestMentorshipSession({ courseId: program.courseId, slots: picked, note })
          if (res.success) {
            setSlots(["", "", ""])
            setNote("")
            onSent()
          } else {
            setError(res.error)
          }
        })
      }}
    >
      <p className="text-[13px] text-ws-muted">
        Propose up to three times that suit you. {program.instructorName} confirms one.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {slots.map((value, i) => (
          <div key={i} className="min-w-0 space-y-1">
            <Label htmlFor={`slot-${program.courseId}-${i}`} className="text-[11px] text-ws-muted">
              {i === 0 ? "Option 1" : `Option ${i + 1} (optional)`}
            </Label>
            <Input
              id={`slot-${program.courseId}-${i}`}
              type="datetime-local"
              value={value}
              min={minLocal}
              required={i === 0}
              onChange={(e) => {
                const next = e.target.value
                setSlots((prev) => prev.map((slot, j) => (j === i ? next : slot)))
              }}
              className="h-10 w-full min-w-0 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`note-${program.courseId}`} className="text-[11px] text-ws-muted">
          What would you like to cover? (optional)
        </Label>
        <Textarea
          id={`note-${program.courseId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          className="min-h-16"
        />
      </div>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Sending…" : "Request a session"}
      </Button>
    </form>
  )
}

function ProgramCard({ program, onChanged }: { program: MentorshipProgram; onChanged: () => void }) {
  return (
    <section className="space-y-5 rounded-lg bg-ws-surface p-5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">Executive mentorship</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-ws-primary">{program.courseTitle}</h2>
        <p className="text-[13px] text-ws-muted">Your mentor · {program.instructorName}</p>
      </div>

      <div className="rounded-md bg-ws-sunken p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ws-primary">
          <CompassIcon size={14} className="text-ws-muted" aria-hidden />
          Your roadmap
        </h3>
        {program.roadmap ? (
          <>
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ws-primary">
              {program.roadmap.text}
            </p>
            <p className="mt-2 text-[11px] tabular-nums text-ws-subtle">
              Updated {formatDateTime(program.roadmap.updatedAt)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-ws-muted">
            Your mentor hasn&apos;t written your roadmap yet — it appears here once they do.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ws-primary">
          <CalendarClockIcon size={14} className="text-ws-muted" aria-hidden />
          Private sessions
        </h3>
        {program.hasOpenRequest ? (
          <p className="text-[13px] text-ws-muted">
            Your request is with {program.instructorName}. You&apos;ll get a notification when they confirm a time.
          </p>
        ) : (
          <RequestForm program={program} onSent={onChanged} />
        )}
      </div>
    </section>
  )
}

function SessionRow({ session, onChanged }: { session: MentorshipSessionView; onChanged: () => void }) {
  const [confirming, setConfirming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const chip = SESSION_STATUS[session.status]
  const cancellable = session.status === "requested" || session.status === "upcoming"

  return (
    <li className="rounded-md bg-ws-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ws-primary">{session.courseTitle}</p>
          <p className="text-[11px] tabular-nums text-ws-muted">
            {session.scheduledAt
              ? formatDateTime(session.scheduledAt)
              : `Proposed: ${session.proposedSlots.map((slot) => formatDateTime(slot)).join(" · ")}`}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", chip.className)}>
          {chip.label}
        </span>
      </div>
      {session.responseNote && (
        <p className="mt-2 break-words text-[12px] text-ws-muted">“{session.responseNote}”</p>
      )}
      {(session.joinHref || cancellable) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {session.joinHref && (
            <Button size="sm" variant="outline" render={<Link href={session.joinHref} />}>
              Open session
            </Button>
          )}
          {cancellable &&
            (confirming ? (
              <>
                <span className="text-[12px] text-ws-muted">
                  Cancel this {session.status === "requested" ? "request" : "session"}?
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null)
                      const res = await cancelMentorshipSession(session.id)
                      if (res.success) onChanged()
                      else setError(res.error)
                    })
                  }
                >
                  {pending ? "Cancelling…" : "Yes, cancel"}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
                Cancel
              </Button>
            ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-ws-danger">{error}</p>}
    </li>
  )
}

export default function MentorshipPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.mentorship,
    queryFn: () => getMyMentorship(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // a confirmation shows up without a reload
  })
  const programs = data?.programs ?? []
  const sessions = data?.sessions ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.mentorship })

  return (
    <>
      <Topbar title="Mentorship" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-4xl space-y-8">
          <PageHeader title="Mentorship" subline="Private 1-on-1 sessions and your personal roadmap." />

          {isLoading ? (
            <div className="h-48 animate-pulse rounded-lg bg-ws-surface" />
          ) : programs.length === 0 && sessions.length === 0 ? (
            <div className="rounded-lg bg-ws-surface px-6 py-8">
              <p className="text-[15px] font-semibold text-ws-primary">Mentorship comes with Executive packages</p>
              <p className="mt-1 text-[13px] text-ws-muted">
                When you enrol in an Executive package, your mentor, roadmap and private sessions appear here.
              </p>
              <Link
                href="/dashboard/courses"
                className="mt-4 inline-flex text-[13px] font-medium text-ws-primary hover:underline"
              >
                Browse programs
              </Link>
            </div>
          ) : (
            <>
              {programs.map((program) => (
                <ProgramCard key={program.courseId} program={program} onChanged={refresh} />
              ))}
              {sessions.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-ws-primary">Sessions</h2>
                  <ul className="space-y-2">
                    {sessions.map((session) => (
                      <SessionRow key={session.id} session={session} onChanged={refresh} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
