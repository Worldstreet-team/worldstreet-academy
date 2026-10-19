"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarDays } from "@/components/icons"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  adminUpdateCohort,
  type AdminCohortRow,
  type CohortFormInput,
} from "@/lib/actions/admin-cohorts"
import { cohortDateFull, lagosLocal } from "@/lib/cohort"
import { COHORT_STATUS_LABEL } from "@/lib/cohort-rules"

/** "HH:mm" of an ISO instant, in Lagos. */
const lagosTime = (iso: string) => lagosLocal(iso).slice(11)

type FormState = { number: string; startsAt: string; endsAt: string; note: string }

export default function AdminCohortsPage() {
  const queryClient = useQueryClient()
  // "new" = adding, otherwise the row being edited; `open` says whether the dialog shows.
  const [target, setTarget] = React.useState<AdminCohortRow | "new" | null>(null)
  // Closing keeps `target`, so the title doesn't change during the close animation.
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>({ number: "1", startsAt: "", endsAt: "", note: "" })
  const [error, setError] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "cohorts"],
    queryFn: () => adminListCohorts(),
  })
  const cohorts = data?.success ? data.data.cohorts : []
  const fallback = data?.success ? data.data.fallback : null

  const editing = target && target !== "new" ? target : null
  const startedEdit = editing !== null && editing.status !== "upcoming"

  const save = useMutation({
    mutationFn: () => {
      const input: CohortFormInput = {
        number: Number(form.number),
        startsAt: form.startsAt,
        endsAt: form.endsAt || null,
        note: form.note.trim() || null,
      }
      return editing ? adminUpdateCohort(editing.id, input) : adminCreateCohort(input)
    },
    onSuccess: (res) => {
      if (!res.success) {
        setError(res.error)
        return
      }
      setError(null)
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["admin", "cohorts"] })
    },
    onError: () => setError("Couldn't save the cohort"),
  })

  const openNew = () => {
    const highest = cohorts.reduce((max, c) => Math.max(max, c.number), 0)
    setForm({ number: String(highest + 1), startsAt: "", endsAt: "", note: "" })
    setError(null)
    setTarget("new")
    setOpen(true)
  }

  const openEdit = (c: AdminCohortRow) => {
    setForm({
      number: String(c.number),
      startsAt: lagosLocal(c.startsAt),
      endsAt: c.endsAt ? lagosLocal(c.endsAt) : "",
      note: c.note ?? "",
    })
    setError(null)
    setTarget(c)
    setOpen(true)
  }

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <PageHeader
            title="Cohorts"
            subline="The Academy's academic sessions. Every countdown, banner and offer timer follows the next one."
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
              description={
                fallback
                  ? `Until you add one, the site counts down to ${fallback.name}, starting ${cohortDateFull(fallback.startsAt)} (NEXT_PUBLIC_COHORT_STARTS_AT).`
                  : "Add the first cohort to start the countdown."
              }
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
                <p className="text-xs text-ws-subtle">A started cohort keeps its number.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cohort-start">Starts (Lagos time)</Label>
              <Input
                id="cohort-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
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
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={save.isPending || !form.startsAt} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
