"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoaderCircle } from "lucide-react"
import {
  getStudentExamStatus,
  startExamAttempt,
  saveExamAnswers,
  submitExamAttempt,
  type RunnerPayload,
  type ExamResult,
} from "@/lib/actions/exams"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { CircleCheckBigIcon, ClockIcon, XIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/* ── Timed runner ── */

function ExamRunner({
  runner,
  onFinished,
}: {
  runner: RunnerPayload
  onFinished: (result: ExamResult) => void
}) {
  const [answers, setAnswers] = React.useState<Record<string, string[]>>(runner.savedAnswers)
  const [currentQ, setCurrentQ] = React.useState(0)
  const [timeLeft, setTimeLeft] = React.useState(() => new Date(runner.deadlineAt).getTime() - Date.now())
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const dirtyRef = React.useRef(false)
  const answersRef = React.useRef(answers)
  React.useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const submit = React.useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    const res = await submitExamAttempt(runner.attemptId, answersRef.current)
    if (res.success) {
      onFinished(res.result)
    } else {
      setError(res.error)
      setSubmitting(false)
    }
  }, [runner.attemptId, submitting, onFinished])

  // Countdown + hard deadline auto-submit
  React.useEffect(() => {
    const t = setInterval(() => {
      const left = new Date(runner.deadlineAt).getTime() - Date.now()
      setTimeLeft(left)
      if (left <= 0) {
        clearInterval(t)
        void submit()
      }
    }, 1000)
    return () => clearInterval(t)
  }, [runner.deadlineAt, submit])

  // Autosave every 6s while dirty
  React.useEffect(() => {
    const t = setInterval(() => {
      if (!dirtyRef.current) return
      dirtyRef.current = false
      void saveExamAnswers(runner.attemptId, answersRef.current)
    }, 6000)
    return () => clearInterval(t)
  }, [runner.attemptId])

  const setAnswer = (qid: string, type: "single" | "multi", optionId: string) => {
    setAnswers((prev) => {
      const current = prev[qid] ?? []
      let next: string[]
      if (type === "single") {
        next = [optionId]
      } else {
        next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
      }
      dirtyRef.current = true
      return { ...prev, [qid]: next }
    })
  }

  const answeredCount = runner.questions.filter((q) => (answers[q.id] ?? []).length > 0).length
  const urgent = timeLeft < 120_000

  const jumpToQuestion = (qi: number) => {
    setCurrentQ(qi)
    document
      .getElementById(`exam-question-${qi}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Sticky timer + question navigator (topbar is h-16) */}
      <div className="sticky top-16 z-30 -mx-1 px-1 space-y-2">
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
            urgent ? "border-destructive/40 bg-destructive/10" : "border-ws-hairline bg-ws-surface"
          }`}
        >
          <span className="text-xs font-medium">
            {answeredCount}/{runner.questions.length} answered
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums ${
              urgent ? "text-destructive" : ""
            }`}
          >
            <ClockIcon  size={15} />
            {fmtClock(timeLeft)}
          </span>
        </div>

        {/* Question navigator — answered = gold, unanswered = chip, current = ring */}
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-ws-hairline bg-ws-surface px-3 py-2">
          {runner.questions.map((q, qi) => {
            const answered = (answers[q.id] ?? []).length > 0
            const isCurrent = qi === currentQ
            return (
              <button
                key={q.id}
                type="button"
                aria-label={`Go to question ${qi + 1}${answered ? " (answered)" : ""}`}
                onClick={() => jumpToQuestion(qi)}
                className={`h-7 w-7 rounded-sm text-[11px] font-semibold tabular-nums transition-colors duration-[var(--ws-motion-fast)] ${
                  answered
                    ? "bg-ws-brand text-ws-brand-on"
                    : "bg-ws-chip text-ws-muted hover:text-ws-primary"
                } ${isCurrent ? "ring-2 ring-ws-brand" : ""}`}
              >
                {qi + 1}
              </button>
            )
          })}
        </div>
      </div>

      {/* Questions */}
      {runner.questions.map((q, qi) => {
        const chosen = answers[q.id] ?? []
        return (
          <Card key={q.id} id={`exam-question-${qi}`} className="scroll-mt-40">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-relaxed">
                  <span className="text-muted-foreground mr-1.5">{qi + 1}.</span>
                  {q.prompt}
                </p>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {q.points} pt{q.points === 1 ? "" : "s"}
                  {q.type === "multi" ? " · multi" : ""}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {q.options.map((opt) => {
                  const selected = chosen.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setAnswer(q.id, q.type, opt.id)
                        setCurrentQ(qi)
                      }}
                      className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                        selected
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-ws-hairline hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 shrink-0 border flex items-center justify-center ${
                          q.type === "single" ? "rounded-full" : "rounded"
                        } ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}
                      >
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      {opt.text}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      <Button className="w-full" disabled={submitting} onClick={() => setConfirmOpen(true)}>
        {submitting ? "Submitting…" : "Submit exam"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your answers?</DialogTitle>
            <DialogDescription>
              You&apos;ve answered {answeredCount} of {runner.questions.length} questions.
              {answeredCount < runner.questions.length &&
                " Unanswered questions score zero."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Keep working
            </Button>
            <Button
              size="sm"
              disabled={submitting}
              onClick={() => {
                setConfirmOpen(false)
                void submit()
              }}
            >
              Submit now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Page ── */

export default function CourseExamPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[40dvh] items-center justify-center">
          <LoaderCircle className="h-5 w-5 animate-spin text-ws-muted" aria-label="Loading exam" />
        </div>
      }
    >
      <CourseExamPageInner />
    </React.Suspense>
  )
}

function CourseExamPageInner() {
  const params = useParams<{ courseId: string }>()
  const courseId = params.courseId
  const search = useSearchParams()
  // Lesson knowledge checks reuse this whole page via ?lesson=<id>.
  const lessonId = search.get("lesson")
  const router = useRouter()
  const queryClient = useQueryClient()

  const [runner, setRunner] = React.useState<RunnerPayload | null>(null)
  const [result, setResult] = React.useState<ExamResult | null>(null)
  const [startError, setStartError] = React.useState<string | null>(null)

  const { data: status, isLoading } = useQuery({
    queryKey: [...queryKeys.examStatus(courseId), lessonId ?? "final"],
    queryFn: () => getStudentExamStatus(courseId, lessonId),
    enabled: !runner && !result,
  })

  const start = useMutation({
    mutationFn: () => startExamAttempt(courseId, lessonId),
    onSuccess: (res) => {
      if (res.success) {
        setStartError(null)
        setRunner(res.runner)
      } else {
        setStartError(res.error)
      }
    },
  })

  const finish = (r: ExamResult) => {
    setRunner(null)
    setResult(r)
    queryClient.invalidateQueries({ queryKey: [...queryKeys.examStatus(courseId), lessonId ?? "final"] })
    queryClient.invalidateQueries({ queryKey: ["enrollments"] })
  }

  return (
    <>
      <Topbar />
      <div className="p-4 sm:p-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
        {runner ? (
          <ExamRunner runner={runner} onFinished={finish} />
        ) : result ? (
          /* ── Result screen ── */
          <div className="max-w-md mx-auto pt-8">
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <div
                  className={`mx-auto h-14 w-14 rounded-full flex items-center justify-center ${
                    result.passed ? "bg-ws-success/10 text-ws-success" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  <RenderIcon icon={result.passed ? CircleCheckBigIcon : XIcon}
                    
                    size={28} />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">
                    {result.passed ? "You passed!" : "Not this time"}
                  </h1>
                  <p className="text-3xl font-bold mt-2">{result.scorePercent}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.pointsEarned}/{result.pointsTotal} points · pass mark{" "}
                    {result.passMarkPercent}%
                  </p>
                </div>

                {result.passed ? (
                  <div className="space-y-2">
                    {!lessonId && result.courseCompleted && (
                      <p className="text-xs text-ws-success font-medium">
                        Course completed — your certificate is ready.
                      </p>
                    )}
                    <div className="flex items-center gap-2 justify-center">
                      {lessonId ? (
                        <Button
                          size="sm"
                          render={<Link href={`/dashboard/courses/${courseId}/learn/${lessonId}`} />}
                        >
                          Back to lesson
                        </Button>
                      ) : (
                        <Button size="sm" render={<Link href={`/dashboard/courses/${courseId}/certificate`} />}>
                          View certificate
                        </Button>
                      )}
                      <Button size="sm" variant="outline" render={<Link href={`/dashboard/courses/${courseId}`} />}>
                        Back to course
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {result.attemptsLeft === null
                        ? "You can retake the exam any time."
                        : result.attemptsLeft > 0
                          ? `${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} left.`
                          : "No attempts left — contact support if you think this is wrong."}
                    </p>
                    <div className="flex items-center gap-2 justify-center">
                      {(result.attemptsLeft === null || result.attemptsLeft > 0) && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setResult(null)
                            start.mutate()
                          }}
                        >
                          Retake exam
                        </Button>
                      )}
                      <Button size="sm" variant="outline" render={<Link href={`/dashboard/courses/${courseId}`} />}>
                        Back to course
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : isLoading ? (
          <div className="max-w-md mx-auto pt-8 space-y-3">
            <Skeleton className="h-48 rounded-lg" />
          </div>
        ) : !status || !status.hasExam ? (
          /* ── No exam ── */
          <div className="max-w-md mx-auto pt-8">
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <p className="text-sm font-medium">No exam for this course</p>
                <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/courses/${courseId}`)}>
                  Back to course
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* ── Intro screen ── */
          <div className="max-w-md mx-auto pt-8">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="text-center">
                  <Badge variant="secondary" className="text-[10px] mb-2">
                    {lessonId
                      ? "Knowledge check"
                      : status.examRequired
                        ? "Required for certificate"
                        : "Optional assessment"}
                  </Badge>
                  <h1 className="text-lg font-semibold">{status.title}</h1>
                  {status.instructions && (
                    <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                      {status.instructions}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 py-2.5">
                    <p className="text-sm font-semibold">{status.questionCount}</p>
                    <p className="text-[10px] text-muted-foreground">Questions</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 py-2.5">
                    <p className="text-sm font-semibold">{status.durationMinutes}m</p>
                    <p className="text-[10px] text-muted-foreground">Time limit</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 py-2.5">
                    <p className="text-sm font-semibold">{status.passMarkPercent}%</p>
                    <p className="text-[10px] text-muted-foreground">Pass mark</p>
                  </div>
                </div>

                {status.examPassed && (
                  <p className="text-xs text-ws-success text-center font-medium">
                    Already passed{status.bestScorePercent != null ? ` — best score ${status.bestScorePercent}%` : ""}
                  </p>
                )}

                {!status.eligible ? (
                  <div className="text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Finish all lessons to unlock the exam — you&apos;re at {status.progress}%.
                    </p>
                    <Button size="sm" variant="outline" render={<Link href={`/dashboard/courses/${courseId}`} />}>
                      Continue learning
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {startError && <p className="text-xs text-destructive text-center">{startError}</p>}
                    <Button
                      className="w-full"
                      disabled={
                        start.isPending ||
                        (!status.activeAttemptId &&
                          status.attemptsLeft !== null &&
                          status.attemptsLeft <= 0 &&
                          !status.examPassed)
                      }
                      onClick={() => start.mutate()}
                    >
                      {start.isPending
                        ? "Preparing…"
                        : status.activeAttemptId
                          ? "Resume attempt"
                          : status.examPassed
                            ? "Take again"
                            : "Start exam"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      {status.attemptsLeft === null
                        ? "Unlimited attempts"
                        : `${status.attemptsLeft} of ${status.maxAttempts} attempts left`}
                      {" · "}the timer keeps running once you start.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
