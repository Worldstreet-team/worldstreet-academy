"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  adminGetApplication,
  adminStartApplicationReview,
  adminAddApplicationNote,
  adminDecideApplication,
  adminScheduleInterview,
  adminProposeSlots,
  adminAssignApplication,
  adminSaveScorecard,
} from "@/lib/actions/applications"
import type { RejectionReason } from "@/lib/db/models"

const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
  { value: "not_enough_experience", label: "Not enough experience" },
  { value: "content_fit", label: "Not a fit for our catalog" },
  { value: "quality_concerns", label: "Quality concerns" },
  { value: "incomplete_application", label: "Incomplete application" },
  { value: "other", label: "Other" },
]
import { queryKeys } from "@/lib/hooks/queries/keys"
import { formatDate, formatDateTime, StatusBadge } from "@/components/admin/shared"

function LinkRow({ label, href }: { label: string; href?: string }) {
  if (!href) return null
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline truncate max-w-[240px]"
      >
        {href.replace(/^https?:\/\//, "")}
      </a>
    </div>
  )
}

export default function AdminApplicationDetailPage() {
  const params = useParams<{ applicationId: string }>()
  const applicationId = params.applicationId
  const queryClient = useQueryClient()

  const [note, setNote] = React.useState("")
  const [decisionDialog, setDecisionDialog] = React.useState<"approved" | "rejected" | null>(null)
  const [decisionNote, setDecisionNote] = React.useState("")
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = React.useState(false)
  const [scheduleAt, setScheduleAt] = React.useState("")
  const [scheduleError, setScheduleError] = React.useState<string | null>(null)
  const [scheduleMin, setScheduleMin] = React.useState("")
  const [proposeOpen, setProposeOpen] = React.useState(false)
  const [proposeSlots, setProposeSlots] = React.useState<string[]>(["", "", ""])
  const [proposeError, setProposeError] = React.useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = React.useState<RejectionReason>("other")
  // Scorecard local state
  const [scDepth, setScDepth] = React.useState(3)
  const [scComms, setScComms] = React.useState(3)
  const [scProd, setScProd] = React.useState(3)
  const [scRec, setScRec] = React.useState<"approve" | "reject" | "unsure">("unsure")
  const [scNotes, setScNotes] = React.useState("")
  const [scSaved, setScSaved] = React.useState(false)

  const { data: app, isLoading } = useQuery({
    queryKey: queryKeys.adminApplicationDetail(applicationId),
    queryFn: () => adminGetApplication(applicationId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminApplicationDetail(applicationId) })
    queryClient.invalidateQueries({ queryKey: ["admin", "applications"] })
  }

  const startReview = useMutation({
    mutationFn: () => adminStartApplicationReview(applicationId),
    onSuccess: (res) => {
      if (!res.success) setActionError(res.error ?? "Failed")
      else setActionError(null)
      invalidate()
    },
  })

  const addNote = useMutation({
    mutationFn: () => adminAddApplicationNote(applicationId, note),
    onSuccess: (res) => {
      if (res.success) setNote("")
      invalidate()
    },
  })

  const decide = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      adminDecideApplication(
        applicationId,
        decision,
        decisionNote,
        decision === "rejected" ? rejectionReason : undefined
      ),
    onSuccess: (res) => {
      if (!res.success) {
        setActionError(res.error ?? "Failed")
      } else {
        setActionError(null)
        setDecisionDialog(null)
        setDecisionNote("")
      }
      invalidate()
    },
  })

  const schedule = useMutation({
    mutationFn: () => adminScheduleInterview(applicationId, new Date(scheduleAt).toISOString()),
    onSuccess: (res) => {
      if (!res.success) {
        setScheduleError(res.error ?? "Failed to schedule")
      } else {
        setScheduleError(null)
        setScheduleOpen(false)
        setScheduleAt("")
      }
      invalidate()
    },
  })

  const propose = useMutation({
    mutationFn: () =>
      adminProposeSlots(
        applicationId,
        proposeSlots.filter(Boolean).map((at) => ({ at: new Date(at).toISOString() }))
      ),
    onSuccess: (res) => {
      if (!res.success) {
        setProposeError(res.error ?? "Failed to propose slots")
      } else {
        setProposeError(null)
        setProposeOpen(false)
        setProposeSlots(["", "", ""])
      }
      invalidate()
    },
  })

  const assign = useMutation({
    mutationFn: (v: boolean) => adminAssignApplication(applicationId, v),
    onSuccess: invalidate,
  })

  const saveScorecard = useMutation({
    mutationFn: () =>
      adminSaveScorecard(applicationId, {
        expertiseDepth: scDepth,
        communication: scComms,
        productionReadiness: scProd,
        recommendation: scRec,
        notes: scNotes,
      }),
    onSuccess: (res) => {
      if (res.success) {
        setScSaved(true)
        setTimeout(() => setScSaved(false), 1500)
      }
      invalidate()
    },
  })

  // Hydrate scorecard form when the application loads
  React.useEffect(() => {
    if (app?.scorecard) {
      setScDepth(app.scorecard.expertiseDepth)
      setScComms(app.scorecard.communication)
      setScProd(app.scorecard.productionReadiness)
      setScRec(app.scorecard.recommendation)
      setScNotes(app.scorecard.notes)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.scorecard?.at])

  const isActive =
    app && ["submitted", "under_review", "interview_scheduled"].includes(app.status)

  return (
    <>
      <Topbar variant="admin" breadcrumbOverrides={{ [applicationId]: app?.applicantName ?? "Application" }} />
      <div className="p-4 sm:p-6 space-y-4 pb-24 md:pb-6 max-w-4xl">
        {isLoading || !app ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Applicant header */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-12 w-12">
                      {app.applicantAvatar && <AvatarImage src={app.applicantAvatar} />}
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {app.applicantName[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-base font-semibold truncate">{app.applicantName}</h1>
                        <StatusBadge status={app.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{app.applicantEmail}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {app.applicantJoinedAt ? `Joined ${formatDate(app.applicantJoinedAt)} · ` : ""}
                        {app.applicantEnrollments} enrollment{app.applicantEnrollments === 1 ? "" : "s"} ·
                        Applied {formatDate(app.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {isActive && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={assign.isPending}
                        onClick={() => assign.mutate(!app.assignedToName)}
                      >
                        {app.assignedToName ? `⊘ Unassign (${app.assignedToName})` : "Assign to me"}
                      </Button>
                      {app.status === "submitted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={startReview.isPending}
                          onClick={() => startReview.mutate()}
                        >
                          Start review
                        </Button>
                      )}
                      {!app.interview && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setProposeError(null)
                            setScheduleMin(new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16))
                            setProposeOpen(true)
                          }}
                        >
                          Propose slots
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setScheduleError(null)
                          setScheduleMin(new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16))
                          setScheduleOpen(true)
                        }}
                      >
                        {app.interview ? "Reschedule interview" : "Schedule directly"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setDecisionDialog("approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDecisionDialog("rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
                {app.proposedSlots.length > 0 && !app.interview && (
                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                    <p className="text-xs font-semibold">
                      Waiting on the applicant to pick a slot
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {app.proposedSlots
                        .map((s) =>
                          new Date(s.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
                        )
                        .join(" · ")}
                    </p>
                  </div>
                )}
                {actionError && (
                  <p className="text-xs text-destructive mt-2">{actionError}</p>
                )}
                {app.interview && (
                  <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-xs font-semibold">Interview scheduled</p>
                      <p className="text-[11px] text-muted-foreground">
                        {app.interview.scheduledAt
                          ? new Date(app.interview.scheduledAt).toLocaleString("en-US", {
                              dateStyle: "full",
                              timeStyle: "short",
                            })
                          : "Time not set"}
                      </p>
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      render={<a href={app.interview.joinPath} />}
                    >
                      Open interview room
                    </Button>
                  </div>
                )}
                {app.status === "rejected" && app.decisionNote && (
                  <p className="text-xs text-muted-foreground mt-2 border-l-2 border-destructive/40 pl-2">
                    Decision note: {app.decisionNote}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-5 gap-4">
              {/* Answers */}
              <div className="lg:col-span-3 space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        Headline
                      </p>
                      <p className="text-sm font-medium">{app.answers.headline}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Expertise
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {app.answers.expertise.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                        {app.answers.experienceYears && (
                          <Badge variant="outline" className="text-[10px]">
                            {app.answers.experienceYears} yrs experience
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        Experience
                      </p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {app.answers.experience}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        Motivation
                      </p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {app.answers.motivation}
                      </p>
                    </div>
                    <div className="space-y-1.5 pt-1 border-t border-border/50">
                      <LinkRow label="Portfolio" href={app.answers.portfolioUrl} />
                      <LinkRow label="Sample video" href={app.answers.sampleVideoUrl} />
                      <LinkRow label="CV / credentials" href={app.answers.cvUrl} />
                      <LinkRow label="LinkedIn" href={app.answers.linkedin} />
                      <LinkRow label="Twitter / X" href={app.answers.twitter} />
                      <LinkRow label="Website" href={app.answers.website} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Notes + timeline */}
              <div className="lg:col-span-2 space-y-4">
                {/* Interview scorecard */}
                {isActive && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold">Interview scorecard</h2>
                        {app.scorecard && (
                          <span className="text-[10px] text-muted-foreground">
                            {app.scorecard.byName}
                          </span>
                        )}
                      </div>
                      {(
                        [
                          ["Expertise depth", scDepth, setScDepth],
                          ["Communication", scComms, setScComms],
                          ["Production readiness", scProd, setScProd],
                        ] as const
                      ).map(([label, value, setter]) => (
                        <div key={label} className="flex items-center justify-between gap-2">
                          <span className="text-xs">{label}</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setter(n)}
                                className={`h-6 w-6 rounded-md text-[10px] font-semibold border transition-colors ${
                                  value >= n
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border/60 text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-1.5 pt-1">
                        {(["approve", "unsure", "reject"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setScRec(r)}
                            className={`text-xs px-2.5 py-1 rounded-full border capitalize transition-colors ${
                              scRec === r
                                ? r === "approve"
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : r === "reject"
                                    ? "bg-destructive text-white border-destructive"
                                    : "bg-foreground text-background border-foreground"
                                : "border-border/60 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={scNotes}
                        onChange={(e) => setScNotes(e.target.value)}
                        placeholder="Interview impressions…"
                        className="text-xs min-h-14"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={saveScorecard.isPending}
                        onClick={() => saveScorecard.mutate()}
                      >
                        {saveScorecard.isPending ? "Saving…" : scSaved ? "Saved ✓" : "Save scorecard"}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="p-4">
                    <h2 className="text-sm font-semibold mb-2">Reviewer notes</h2>
                    <div className="space-y-2 mb-3">
                      {app.reviewerNotes.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No notes yet.</p>
                      ) : (
                        app.reviewerNotes.map((n, i) => (
                          <div key={i} className="rounded-lg bg-muted/50 px-2.5 py-2">
                            <p className="text-xs whitespace-pre-wrap">{n.note}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {n.byName} · {formatDateTime(n.at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add an internal note…"
                      className="text-xs min-h-16"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      disabled={!note.trim() || addNote.isPending}
                      onClick={() => addNote.mutate()}
                    >
                      {addNote.isPending ? "Saving…" : "Add note"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h2 className="text-sm font-semibold mb-2">Timeline</h2>
                    <div className="space-y-2">
                      {app.history.map((h, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium capitalize">
                              {h.status.replace(/_/g, " ")}
                              {h.by ? ` — ${h.by}` : ""}
                            </p>
                            {h.note && (
                              <p className="text-[11px] text-muted-foreground">{h.note}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/70">
                              {formatDateTime(h.at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Schedule interview dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {app?.interview ? "Reschedule interview" : "Schedule interview"}
            </DialogTitle>
            <DialogDescription>
              Creates a private interview room with a waiting room. {app?.applicantName} gets an
              email + in-app invite with the join link; you start the call by opening the room at
              the scheduled time.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            min={scheduleMin}
          />
          {scheduleError && <p className="text-xs text-destructive">{scheduleError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!scheduleAt || schedule.isPending}
              onClick={() => schedule.mutate()}
            >
              {schedule.isPending
                ? "Scheduling…"
                : app?.interview
                  ? "Reschedule & notify"
                  : "Schedule & invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Propose slots dialog */}
      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose interview slots</DialogTitle>
            <DialogDescription>
              Offer up to three times — {app?.applicantName} picks one from their status page
              and the interview room is created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {proposeSlots.map((v, i) => (
              <Input
                key={i}
                type="datetime-local"
                value={v}
                min={scheduleMin}
                onChange={(e) =>
                  setProposeSlots((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
                }
              />
            ))}
          </div>
          {proposeError && <p className="text-xs text-destructive">{proposeError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setProposeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={propose.isPending || proposeSlots.every((s) => !s)}
              onClick={() => propose.mutate()}
            >
              {propose.isPending ? "Sending…" : "Send to applicant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision dialog */}
      <Dialog open={decisionDialog !== null} onOpenChange={(open) => !open && setDecisionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionDialog === "approved" ? "Approve application" : "Reject application"}
            </DialogTitle>
            <DialogDescription>
              {decisionDialog === "approved"
                ? `${app?.applicantName} becomes an INSTRUCTOR immediately — their instructor portal unlocks and their public profile is seeded from this application.`
                : `${app?.applicantName} will be notified. They can apply again after 30 days.`}
            </DialogDescription>
          </DialogHeader>
          {decisionDialog === "rejected" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {REJECTION_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRejectionReason(r.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    rejectionReason === r.value
                      ? "bg-foreground text-background border-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <Textarea
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            placeholder={
              decisionDialog === "approved"
                ? "Optional welcome note (included in the email)…"
                : "Reason details (required — included in the email)…"
            }
            className="text-xs min-h-20"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDecisionDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={decisionDialog === "rejected" ? "destructive" : "default"}
              disabled={
                decide.isPending || (decisionDialog === "rejected" && !decisionNote.trim())
              }
              onClick={() => decisionDialog && decide.mutate(decisionDialog)}
            >
              {decide.isPending
                ? "Saving…"
                : decisionDialog === "approved"
                  ? "Approve & promote"
                  : "Reject application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
