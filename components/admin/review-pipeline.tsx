"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { adminApproveCourseReview, adminRecordReviewCheck, type AdminCourseReview } from "@/lib/actions/admin-course-review"
import { CHECK_STATUS_LABEL, REVIEW_CHECK_DETAILS, type ReviewCheckKey, type ReviewCheckStatus } from "@/lib/review-checks"

const STATE_LABEL = { none: "Not submitted", pending: "In review", approved: "Approved", changes_requested: "Changes requested" } as const

const CHIP_TONE: Record<ReviewCheckStatus | "none" | "stale", string> = {
  none: "bg-ws-chip text-ws-muted",
  stale: "bg-ws-warning/15 text-ws-warning",
  passed: "bg-ws-success/15 text-ws-success",
  "n/a": "bg-ws-chip text-ws-primary",
  changes: "bg-ws-danger/15 text-ws-danger",
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/**
 * Quality control: the four recorded checks, one card each, and the approval
 * that waits for all four on the current content (blueprint §17).
 */
export function ReviewPipeline({ review }: { review: AdminCourseReview }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [changesFor, setChangesFor] = React.useState<ReviewCheckKey | null>(null)
  const [note, setNote] = React.useState("")

  const open = review.review.status === "pending"
  const togo = review.outstanding.length

  function record(check: ReviewCheckKey, status: ReviewCheckStatus, text: string) {
    setError(null)
    startTransition(async () => {
      const res = await adminRecordReviewCheck(review.id, check, status, text)
      if (!res.success) {
        setError(res.error)
        return
      }
      setChangesFor(null)
      setNote("")
      router.refresh()
    })
  }

  function approve() {
    setError(null)
    startTransition(async () => {
      const res = await adminApproveCourseReview(review.id)
      if (!res.success) {
        setError(res.error)
        return
      }
      router.push("/admin/courses?review=pending")
    })
  }

  return (
    <section aria-labelledby="quality-control" className="space-y-4">
      <h2 id="quality-control" className="font-display text-lg font-semibold text-ws-primary">
        Quality control
      </h2>

      <ol className="space-y-3">
        {review.checks.map((c, i) => {
          const detail = REVIEW_CHECK_DETAILS[c.key]
          const tone = c.stale ? "stale" : (c.status ?? "none")
          return (
            <li key={c.key} className="rounded-[20px] border border-ws-hairline bg-ws-surface p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-ws-primary">
                  <span className="tabular-nums">{i + 1}.</span> {detail.title}
                  {detail.qualifier ? ` · ${detail.qualifier}` : ""}
                </h3>
                <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${CHIP_TONE[tone]}`}>
                  {c.stale ? "Re-check: the content changed" : CHECK_STATUS_LABEL[c.status ?? "none"]}
                </span>
              </div>
              <p className="text-[14px] text-ws-muted">{detail.body}</p>
              {c.status && (c.byName || c.at || c.note) && (
                <div className="text-[13px] text-ws-muted">
                  {(c.byName || c.at) && (
                    <p>
                      {[c.byName, c.at ? day(c.at) : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {c.note && <p className="mt-1 whitespace-pre-line text-ws-primary">{c.note}</p>}
                </div>
              )}
              {open && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => record(c.key, "passed", "")}>
                    Pass
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setNote("")
                      setChangesFor(c.key)
                    }}
                  >
                    Needs changes…
                  </Button>
                  {c.key === "accuracy" && (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => record(c.key, "n/a", "")}>
                      Not applicable
                    </Button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {error && (
        <p role="alert" className="text-[13px] text-ws-danger">
          {error}
        </p>
      )}

      {open ? (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button disabled={pending || togo > 0} onClick={approve}>
            {pending ? "Working…" : "Approve & publish"}
          </Button>
          {togo > 0 && (
            <span className="text-[13px] text-ws-muted">
              <span className="tabular-nums">{togo}</span> {togo === 1 ? "check" : "checks"} to go
            </span>
          )}
        </div>
      ) : (
        <p className="text-[14px] text-ws-muted">
          This course isn&apos;t waiting for review · {STATE_LABEL[review.review.status]}
        </p>
      )}

      <Dialog open={changesFor !== null} onOpenChange={(o) => !o && setChangesFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              What needs to change? ({changesFor ? REVIEW_CHECK_DETAILS[changesFor].title : ""})
            </DialogTitle>
            <DialogDescription>
              It goes back to its Marketplace Creator with this note, by email and in the app. Checks that passed stay
              passed unless the content changes.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Page 3 of the PDF is blank."
            className="min-h-28"
            maxLength={2000}
            aria-label="What needs to change"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setChangesFor(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={pending || note.trim().length < 5}
              onClick={() => changesFor && record(changesFor, "changes", note)}
            >
              {pending ? "Sending…" : "Send back"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
