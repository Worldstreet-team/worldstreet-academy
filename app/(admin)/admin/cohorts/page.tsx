"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarDays } from "@/components/icons"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  adminCreateCohort,
  adminListCohorts,
  adminRemoveCohort,
  adminUpdateCohort,
  type AdminCohortRow,
  type CohortFormInput,
} from "@/lib/actions/admin-cohorts"
import { cohortDateFull, lagosLocal } from "@/lib/cohort"
import { COHORT_STATUS_LABEL } from "@/lib/cohort-rules"
import { useClientNow } from "@/lib/hooks/use-now"

const PAST_START = "That start date has already passed. Check the year."

/** "HH:mm" of an ISO instant, in Lagos. */
const lagosTime = (iso: string) => lagosLocal(iso).slice(11)

type FormState = { number: string; startsAt: string; endsAt: string; shown: boolean; note: string }

const plural = (n: number) => `${n} ${n === 1 ? "learner" : "learners"}`

/**
 * What removing `c` does, in words. Learners are placed by enrolment date in
 * the first cohort starting at or after it, else the latest one, and starts
 * are strictly ordered, so `c`'s learners all land in the next cohort by
 * start, else the one before it, else the next cohort an admin adds.
 */
function removalEffect(c: AdminCohortRow, cohorts: AdminCohortRow[]): string {
  const start = Date.parse(c.startsAt)
  const others = cohorts
    .filter((o) => o.id !== c.id)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  const lands =
    others.find((o) => Date.parse(o.startsAt) > start) ??
    others.filter((o) => Date.parse(o.startsAt) < start).at(-1) ??
    null
  const learners =
    c.learners === 0
      ? "No learners are placed in it."
      : lands
        ? `Learners are placed by the date they enrolled, so its ${plural(c.learners)} will show under ${lands.name}.`
        : `Its ${plural(c.learners)} will show under the next cohort you add.`
  const site = lands ? "" : " With no cohorts left, the website shows no countdown until you add one."
  return `${learners}${site} This can't be undone.`
}

export default function AdminCohortsPage() {
  const queryClient = useQueryClient()
  // "new" = adding, otherwise the row being edited; `open` says whether the dialog shows.
  const [target, setTarget] = React.useState<AdminCohortRow | "new" | null>(null)
  // Closing keeps `target`, so the title doesn't change during the close animation.
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>({ number: "1", startsAt: "", endsAt: "", shown: true, note: "" })
  const [error, setError] = React.useState<string | null>(null)
  // The edit dialog's second step: "Remove Cohort 00N?" in place of the form.
  const [confirmRemove, setConfirmRemove] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "cohorts"],
    queryFn: () => adminListCohorts(),
  })
  const cohorts = data?.success ? data.data.cohorts : []

  const editing = target && target !== "new" ? target : null
  const startedEdit = editing !== null && editing.status !== "upcoming"

  // 2026-11-12: a NEW cohort's earliest start, mirroring adminCreateCohort's refusal.
  // The form's dates are Lagos wall time whatever this browser's zone, so the
  // bound is Lagos too (lagosLocal), not the browser's (datetimeLocalValue) nor
  // UTC (toISOString). The next whole minute: the server refuses "now" itself.
  // The browser clock is null on the server and through hydration (no mismatch).
  const clientNow = useClientNow()
  const minStart = target === "new" && clientNow !== null ? lagosLocal(new Date(clientNow + 60_000).toISOString()) : undefined
  // Same-shape `YYYY-MM-DDTHH:mm` strings compare in time order.
  const startPast = minStart !== undefined && form.startsAt !== "" && form.startsAt < minStart

  const settle = (res: { success: true } | { success: false; error: string }) => {
    if (!res.success) {
      setError(res.error)
      return
    }
    setError(null)
    setOpen(false)
    queryClient.invalidateQueries({ queryKey: ["admin", "cohorts"] })
  }

  const save = useMutation({
    mutationFn: () => {
      const input: CohortFormInput = {
        number: Number(form.number),
        startsAt: form.startsAt,
        endsAt: form.endsAt || null,
        hidden: !form.shown,
        note: form.note.trim() || null,
      }
      return editing ? adminUpdateCohort(editing.id, input) : adminCreateCohort(input)
    },
    onSuccess: settle,
    onError: () => setError("Couldn't save the cohort"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminRemoveCohort(id),
    onSuccess: settle,
    onError: () => setError("Couldn't remove the cohort"),
  })

  const openNew = () => {
    const highest = cohorts.reduce((max, c) => Math.max(max, c.number), 0)
    setForm({ number: String(highest + 1), startsAt: "", endsAt: "", shown: true, note: "" })
    setError(null)
    setConfirmRemove(false)
    setTarget("new")
    setOpen(true)
  }

  const openEdit = (c: AdminCohortRow) => {
    setForm({
      number: String(c.number),
      startsAt: lagosLocal(c.startsAt),
      endsAt: c.endsAt ? lagosLocal(c.endsAt) : "",
      shown: !c.hidden,
      note: c.note ?? "",
    })
    setError(null)
    setConfirmRemove(false)
    setTarget(c)
    setOpen(true)
  }

  const busy = save.isPending || remove.isPending

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="Cohorts"
            subline="The Academy's academic sessions. Every countdown, banner and offer timer follows the next one, while it is shown on the website."
            action={
              <Button onClick={openNew}>
                Add a cohort
              </Button>
            }
          />

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-[20px]" />
              ))}
            </div>
          ) : data && !data.success ? (
            <p className="text-sm text-ws-danger">{data.error}</p>
          ) : cohorts.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No cohorts yet"
              description="The website shows no cohort countdown until you add one."
            />
          ) : (
            <div className="space-y-2">
              {cohorts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-[20px] border border-ws-hairline bg-ws-surface px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ws-primary">{c.name}</p>
                      <span className="rounded-full bg-ws-chip px-2 py-0.5 text-[11px] font-medium text-ws-muted">
                        {COHORT_STATUS_LABEL[c.status]}
                      </span>
                      {c.hidden && (
                        <span className="rounded-full border border-ws-hairline px-2 py-0.5 text-[11px] font-medium text-ws-muted">
                          Hidden from the website
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ws-muted">
                      Starts {cohortDateFull(c.startsAt)} · {lagosTime(c.startsAt)} Lagos time
                      {c.endsAt && (
                        <>
                          {" "}
                          · Ends {cohortDateFull(c.endsAt)} · {lagosTime(c.endsAt)} Lagos time
                        </>
                      )}
                    </p>
                    {c.note && <p className="text-xs text-ws-subtle">{c.note}</p>}
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-ws-muted">
                    {c.learners} {c.learners === 1 ? "learner" : "learners"}
                  </p>
                  <Button size="xs" variant="outline" onClick={() => openEdit(c)}>
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {editing && confirmRemove ? (
            <>
              <DialogHeader>
                <DialogTitle>{`Remove ${editing.name}?`}</DialogTitle>
                <DialogDescription>{removalEffect(editing, cohorts)}</DialogDescription>
              </DialogHeader>
              {error && <p className="text-xs text-ws-danger">{error}</p>}
              <DialogFooter>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmRemove(false)}>
                  Keep it
                </Button>
                <Button variant="destructive" size="sm" disabled={busy} onClick={() => remove.mutate(editing.id)}>
                  {remove.isPending ? "Removing…" : `Remove ${editing.name}`}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a cohort"}</DialogTitle>
                <DialogDescription>
                  Dates are Lagos time, whatever time zone this browser is in.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cohort-number">Number</Label>
                  <Input
                    id="cohort-number"
                    type="number"
                    min={1}
                    max={999}
                    value={form.number}
                    disabled={startedEdit}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                  />
                  {startedEdit && (
                    <p className="text-xs text-ws-subtle">A started cohort keeps its number. Remove it to free the number.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cohort-start">Starts (Lagos time)</Label>
                  <Input
                    id="cohort-start"
                    type="datetime-local"
                    min={minStart}
                    aria-invalid={startPast || undefined}
                    aria-describedby={startPast ? "cohort-start-past" : undefined}
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                  {startPast && (
                    <p id="cohort-start-past" className="text-xs text-ws-danger">
                      {PAST_START}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cohort-end">Ends (Lagos time, optional)</Label>
                  <Input
                    id="cohort-end"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between gap-4 text-sm font-medium text-ws-primary">
                    Show on the website
                    <Switch checked={form.shown} onCheckedChange={(shown) => setForm({ ...form, shown })} />
                  </label>
                  <p className="text-xs text-ws-subtle">
                    {form.shown
                      ? "Once it's the next cohort, the website counts down to it, and it's listed on the Academic Calendar."
                      : "Hidden: while it's the next cohort, the website shows no countdown, banner or offer timer, and it's left off the Academic Calendar. Learners placed in it still see it."}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cohort-note">Note (admins only)</Label>
                  <Textarea
                    id="cohort-note"
                    maxLength={500}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </div>
              </div>
              {error && <p className="text-xs text-ws-danger">{error}</p>}
              <DialogFooter>
                {editing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-ws-danger sm:mr-auto"
                    disabled={busy}
                    onClick={() => {
                      setError(null)
                      setConfirmRemove(true)
                    }}
                  >
                    Remove cohort
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                {/* 2026-11-12: also while a new cohort's start is already past. */}
                {/* <Button size="sm" disabled={busy || !form.startsAt} onClick={() => save.mutate()}> */}
                <Button size="sm" disabled={busy || !form.startsAt || startPast} onClick={() => save.mutate()}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
