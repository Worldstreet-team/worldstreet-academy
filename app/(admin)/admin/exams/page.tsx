"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { adminListExams, adminResetExamAttempts, type AdminExamRow } from "@/lib/actions/exams"
import { StatusBadge } from "@/components/admin/shared"
import { FileBadgeIcon } from "lucide-react"

export default function AdminExamsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [resetTarget, setResetTarget] = React.useState<AdminExamRow | null>(null)
  const [resetEmail, setResetEmail] = React.useState("")
  const [resetMsg, setResetMsg] = React.useState<string | null>(null)
  const [resetError, setResetError] = React.useState<string | null>(null)
  const [confirming, setConfirming] = React.useState(false)

  const { data: exams, isLoading } = useQuery({
    queryKey: ["admin", "exams"],
    queryFn: () => adminListExams(),
  })

  const reset = useMutation({
    mutationFn: () => adminResetExamAttempts(resetTarget!.id, resetEmail),
    onSuccess: (res) => {
      setConfirming(false)
      if (!res.success) {
        setResetError(res.error ?? "Failed")
        setResetMsg(null)
      } else {
        setResetError(null)
        setResetMsg(
          `Cleared ${res.removed} attempt${res.removed === 1 ? "" : "s"} for ${resetEmail
            .trim()
            .toLowerCase()} — they can retake the exam.`
        )
        // Attempt/pass counts on the list are now stale.
        queryClient.invalidateQueries({ queryKey: ["admin", "exams"] })
      }
    },
  })

  const filtered = React.useMemo(() => {
    if (!exams) return []
    const q = search.trim().toLowerCase()
    if (!q) return exams
    return exams.filter((e) =>
      [e.title, e.courseTitle, e.instructorName].some((s) => s.toLowerCase().includes(q))
    )
  }, [exams, search])

  const closeReset = () => {
    setResetTarget(null)
    setConfirming(false)
  }

  return (
    <>
      <Topbar variant="admin" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-7xl space-y-8">
        <PageHeader
          title="Exams"
          subline="Every course exam, its pass rate, and attempt resets."
        />

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exams, courses or instructors…"
            className="max-w-xs h-10 text-sm"
          />
          {exams && exams.length >= 100 && (
            <p className="text-xs text-ws-subtle">
              Showing the 100 most recently updated exams.
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : !exams || exams.length === 0 ? (
          <EmptyState
            icon={FileBadgeIcon}
            title="No exams yet"
            description="Instructors create exams from their course pages."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileBadgeIcon}
            title="No matches"
            description="No exams match that search."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-lg border border-ws-hairline bg-ws-surface px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate text-ws-primary">{e.title}</p>
                    <StatusBadge status={e.status} />
                    {e.scope === "lesson" && (
                      <Badge variant="outline" className="text-[9px]">knowledge check</Badge>
                    )}
                    {e.required && <Badge variant="secondary" className="text-[9px]">required</Badge>}
                  </div>
                  <p className="text-xs text-ws-muted truncate">
                    {e.courseTitle} · {e.instructorName} · {e.questionCount} questions
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold tabular-nums text-ws-primary">
                    {e.attemptCount > 0
                      ? `${Math.round((e.passCount / e.attemptCount) * 100)}% pass rate`
                      : "no attempts"}
                  </p>
                  <p className="text-[10px] tabular-nums text-ws-muted">
                    {e.passCount}/{e.attemptCount} passed
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setResetTarget(e)
                    setResetEmail("")
                    setResetMsg(null)
                    setResetError(null)
                    setConfirming(false)
                  }}
                >
                  Reset attempts
                </Button>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && closeReset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset attempts — {resetTarget?.title}</DialogTitle>
            <DialogDescription>
              Deletes a student&apos;s failed/expired attempts so they can retake the exam.
              Passed attempts are never removed.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="email"
            value={resetEmail}
            onChange={(e) => {
              setResetEmail(e.target.value)
              setConfirming(false)
              setResetError(null)
            }}
            placeholder="student@email.com"
          />
          {confirming && (
            <p className="text-xs text-ws-muted">
              Clear all failed and expired attempts on this exam for{" "}
              <span className="font-medium text-ws-primary">
                {resetEmail.trim().toLowerCase()}
              </span>
              ? This can&apos;t be undone.
            </p>
          )}
          {resetMsg && <p className="text-xs text-ws-success">{resetMsg}</p>}
          {resetError && <p className="text-xs text-ws-danger">{resetError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeReset}>
              Close
            </Button>
            <Button
              size="sm"
              variant={confirming ? "destructive" : "default"}
              disabled={!resetEmail.includes("@") || reset.isPending}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true)
                  setResetMsg(null)
                } else {
                  reset.mutate()
                }
              }}
            >
              {reset.isPending
                ? "Clearing…"
                : confirming
                  ? "Confirm reset"
                  : "Clear attempts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
