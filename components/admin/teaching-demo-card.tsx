"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, formatDateTime } from "@/components/admin/shared"
import {
  adminRecordDemoOutcome,
  adminRequestTeachingDemo,
  type AdminDemoView,
} from "@/lib/actions/applications"
import type { ApplicationStatus, DemoOutcome } from "@/lib/db/models"

const ACTIVE: ApplicationStatus[] = ["submitted", "under_review", "interview_scheduled"]

const OUTCOMES: { value: DemoOutcome; label: string }[] = [
  { value: "passed", label: "Passed" },
  { value: "not_passed", label: "Not passed" },
]

/**
 * The reviewer's teaching-demonstration controls (institutional blueprint §16,
 * D29): request or reschedule the room while the interview is scheduled, then
 * record the outcome. The outcome is never shown to the applicant.
 */
export function TeachingDemoCard({
  applicationId,
  status,
  demo,
  onChanged,
}: {
  applicationId: string
  status: ApplicationStatus
  demo: AdminDemoView | null
  onChanged: () => void
}) {
  const active = ACTIVE.includes(status)
  const [at, setAt] = React.useState("")
  const [min, setMin] = React.useState("")
  const [outcome, setOutcome] = React.useState<DemoOutcome | null>(demo?.outcome ?? null)
  const [note, setNote] = React.useState(demo?.note ?? "")
  const [scheduleError, setScheduleError] = React.useState<string | null>(null)
  const [outcomeError, setOutcomeError] = React.useState<string | null>(null)

  // Re-hydrate when the saved outcome changes (after a record or a refetch).
  React.useEffect(() => {
    setOutcome(demo?.outcome ?? null)
    setNote(demo?.note ?? "")
  }, [demo?.outcome, demo?.note])

  const refreshMin = () => setMin(new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16))

  const request = useMutation({
    mutationFn: () => adminRequestTeachingDemo(applicationId, new Date(at).toISOString()),
    onSuccess: (res) => {
      if (!res.success) {
        setScheduleError(res.error)
        return
      }
      setScheduleError(null)
      setAt("")
      onChanged()
    },
  })

  const record = useMutation({
    mutationFn: () => adminRecordDemoOutcome(applicationId, outcome as DemoOutcome, note),
    onSuccess: (res) => {
      if (!res.success) {
        setOutcomeError(res.error)
        return
      }
      setOutcomeError(null)
      onChanged()
    },
  })

  const scheduleRow = (label: string, pendingLabel: string) => (
    <div className="space-y-2">
      <Input
        type="datetime-local"
        value={at}
        min={min}
        onFocus={refreshMin}
        onChange={(e) => setAt(e.target.value)}
        aria-label="Teaching demonstration time"
      />
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={!at || request.isPending}
        onClick={() => request.mutate()}
      >
        {request.isPending ? pendingLabel : label}
      </Button>
      {scheduleError && <p className="text-xs text-ws-danger">{scheduleError}</p>}
    </div>
  )

  return (
    <div className="rounded-lg border border-ws-hairline bg-ws-surface p-4 space-y-3">
      <h2 className="text-sm font-semibold">Teaching demonstration</h2>

      {!demo ? (
        status === "interview_scheduled" ? (
          <>
            <p className="text-xs text-muted-foreground">
              Optional. Ask for one after the interview when you want to see the applicant teach.
            </p>
            {scheduleRow("Request teaching demonstration", "Scheduling…")}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Schedule the interview first.</p>
        )
      ) : (
        <>
          <p className="text-xs">
            {demo.scheduledAt ? `Scheduled for ${formatDateTime(demo.scheduledAt)}` : "Scheduled"}
          </p>
          {active && demo.joinPath && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              render={<a href={demo.joinPath} />}
            >
              Open demonstration room
            </Button>
          )}
          {active && !demo.outcome && scheduleRow("Reschedule & notify", "Scheduling…")}

          {active ? (
            <div className="space-y-2 border-t border-ws-hairline pt-3">
              <div className="flex items-center gap-1.5">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOutcome(o.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      outcome === o.value
                        ? o.value === "passed"
                          ? "bg-ws-success/15 text-ws-success border-ws-success/40 font-medium"
                          : "bg-ws-danger/15 text-ws-danger border-ws-danger/40 font-medium"
                        : "border-ws-hairline text-ws-muted hover:bg-ws-raised hover:text-ws-primary"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Notes for the review team…"
                className="text-xs min-h-14"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!outcome || record.isPending}
                onClick={() => record.mutate()}
              >
                {record.isPending ? "Saving…" : "Record outcome"}
              </Button>
              {demo.outcome && demo.decidedAt && (
                <p className="text-[10px] text-muted-foreground">
                  Recorded {formatDate(demo.decidedAt)}
                </p>
              )}
              {outcomeError && <p className="text-xs text-ws-danger">{outcomeError}</p>}
            </div>
          ) : (
            demo.outcome && (
              <div className="space-y-1 border-t border-ws-hairline pt-3">
                <p className="text-xs font-medium">
                  {demo.outcome === "passed" ? "Passed" : "Not passed"}
                  {demo.decidedAt ? ` · ${formatDate(demo.decidedAt)}` : ""}
                </p>
                {demo.note && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{demo.note}</p>
                )}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
