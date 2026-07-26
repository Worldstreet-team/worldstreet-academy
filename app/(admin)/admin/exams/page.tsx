"use client"

import * as React from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Certificate01Icon } from "@hugeicons/core-free-icons"
import { adminListExams, adminResetExamAttempts, type AdminExamRow } from "@/lib/actions/exams"
import { StatusBadge } from "@/components/admin/shared"

export default function AdminExamsPage() {
  const [resetTarget, setResetTarget] = React.useState<AdminExamRow | null>(null)
  const [resetEmail, setResetEmail] = React.useState("")
  const [resetMsg, setResetMsg] = React.useState<string | null>(null)

  const { data: exams, isLoading } = useQuery({
    queryKey: ["admin", "exams"],
    queryFn: () => adminListExams(),
  })

  const reset = useMutation({
    mutationFn: () => adminResetExamAttempts(resetTarget!.id, resetEmail),
    onSuccess: (res) => {
      if (!res.success) setResetMsg(res.error ?? "Failed")
      else setResetMsg(`Cleared ${res.removed} attempt${res.removed === 1 ? "" : "s"} — the student can retake.`)
    },
  })

  return (
    <>
      <Topbar variant="admin" />
      <div className="p-4 sm:p-6 space-y-4 pb-24 md:pb-6">
        <div>
          <h1 className="text-lg font-semibold">Exams</h1>
          <p className="text-sm text-muted-foreground">
            Every course exam, its pass rate, and attempt resets.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !exams || exams.length === 0 ? (
          <EmptyState
            icon={Certificate01Icon}
            title="No exams yet"
            description="Instructors create exams from their course pages."
          />
        ) : (
          <div className="space-y-2">
            {exams.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <StatusBadge status={e.status} />
                    {e.scope === "lesson" && (
                      <Badge variant="outline" className="text-[9px]">knowledge check</Badge>
                    )}
                    {e.required && <Badge variant="secondary" className="text-[9px]">required</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {e.courseTitle} · {e.instructorName} · {e.questionCount} questions
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold">
                    {e.attemptCount > 0
                      ? `${Math.round((e.passCount / e.attemptCount) * 100)}% pass rate`
                      : "no attempts"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
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
                  }}
                >
                  Reset attempts
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
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
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="student@email.com"
          />
          {resetMsg && <p className="text-xs text-muted-foreground">{resetMsg}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResetTarget(null)}>
              Close
            </Button>
            <Button
              size="sm"
              disabled={!resetEmail.includes("@") || reset.isPending}
              onClick={() => reset.mutate()}
            >
              {reset.isPending ? "Clearing…" : "Clear attempts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
