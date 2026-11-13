"use client"
import { LoaderCircle, CheckIcon, CircleCheckBigIcon, ClockIcon, XIcon } from "@/components/icons"

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

import {
  getStudentExamStatus,
  startExamAttempt,
  saveExamAnswers,
  submitExamAttempt,
  getLastExamResult,
  type RunnerPayload,
  type ExamResult,
  type ExamReviewQuestion,
} from "@/lib/actions/exams"
import { queryKeys } from "@/lib/hooks/queries/keys"

import { RenderIcon } from "@/components/shared/render-icon"
import { PackageLockNotice } from "@/components/learn/package-lock-notice"

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
  // 2026-11-12: the deadline on this device's clock, from the time the server
  // said was left — a phone set minutes fast auto-submitted early. (A paper
  // from before the deploy has no remainingMs: the old reading.)
  // const [timeLeft, setTimeLeft] = React.useState(() => new Date(runner.deadlineAt).getTime() - Date.now())
  const [localDeadline] = React.useState(() =>
    typeof runner.remainingMs === "number" ? Date.now() + runner.remainingMs : new Date(runner.deadlineAt).getTime()
  )
  const [timeLeft, setTimeLeft] = React.useState(() => localDeadline - Date.now())
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const dirtyRef = React.useRef(false)
  const answersRef = React.useRef(answers)
  // The timer's own submits: a few tries (a save racing it can fail one), then the button — never a loop every second.
  const autoSubmitsRef = React.useRef(0)
  React.useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const submit = React.useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    // 2026-11-12: a thrown call (offline, or "Failed to find Server Action" after
    // a deploy) left the button on "Submitting…" for good.
    // const res = await submitExamAttempt(runner.attemptId, answersRef.current)
    let res: Awaited<ReturnType<typeof submitExamAttempt>>
    try {
      res = await submitExamAttempt(runner.attemptId, answersRef.current)
    } catch {
      res = { success: false, error: "We couldn't reach the server. Check your connection, or reload the page — your saved answers are kept." }
    }
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
      // const left = new Date(runner.deadlineAt).getTime() - Date.now()
      const left = localDeadline - Date.now()
      setTimeLeft(left)
      // 2026-11-12: a failed submit (it re-armed this effect) retried every second without end.
      // if (left <= 0) {
      //   clearInterval(t)
      //   void submit()
      // }
      if (left <= 0) {
        clearInterval(t)
        if (autoSubmitsRef.current < 3) {
          autoSubmitsRef.current += 1
          void submit()
        }
      }
    }, 1000)
    return () => clearInterval(t)
  }, [localDeadline, submit])

  // Autosave every 6s while dirty
  React.useEffect(() => {
    const t = setInterval(() => {
      if (!dirtyRef.current) return
      dirtyRef.current = false
      // 2026-11-12: a failed save is retried on the next tick; a graded paper
      // (the deadline passed on the server) shows its result.
      // void saveExamAnswers(runner.attemptId, answersRef.current)
      saveExamAnswers(runner.attemptId, answersRef.current)
        .then((res) => {
          if (res.expired && autoSubmitsRef.current < 3) {
            autoSubmitsRef.current += 1
            void submit()
          } else if (!res.success && !res.expired) {
            dirtyRef.current = true
          }
        })
        .catch(() => {
          dirtyRef.current = true
        })
    }, 6000)
    return () => clearInterval(t)
  }, [runner.attemptId, submit])

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

/* ── Marked paper (2026-11-12: the result screen showed only the score) ── */

/** How one option reads on the marked paper. Colour is never the only signal: the labels say it too. */
function optionTone(q: ExamReviewQuestion, optionId: string): "right" | "wrong" | "chosen" | "plain" {
  const chosen = q.chosen.includes(optionId)
  if (q.correctOptionIds) {
    if (q.correctOptionIds.includes(optionId)) return "right"
    return chosen ? "wrong" : "plain"
  }
  if (!chosen) return "plain"
  // Answers not revealed: a right question's picks are all right, and a wrong
  // single-choice pick is wrong; which picks of a wrong multi-choice question
  // were off would give the key away.
  if (q.correct) return "right"
  return q.type === "single" ? "wrong" : "chosen"
}

const OPTION_TONE_CLASS = {
  right: "border-ws-success/50 bg-ws-success/5",
  wrong: "border-destructive/40 bg-destructive/5",
  chosen: "border-primary bg-primary/5",
  plain: "border-ws-hairline",
} as const

function ExamReview({ result }: { result: ExamResult }) {
  if (!result.review || result.review.length === 0) return null
  const rightCount = result.review.filter((q) => q.correct).length

  return (
    <section aria-labelledby="exam-review-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="exam-review-heading" className="text-sm font-semibold">
          Your answers
        </h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {rightCount} of {result.review.length} right
        </p>
      </div>
      {!result.answersRevealed && (
        <p className="rounded-lg border border-ws-hairline bg-ws-surface px-3 py-2 text-xs text-muted-foreground">
          Each question shows whether your answer was right. The correct answers appear once you pass.
        </p>
      )}

      {result.review.map((q, qi) => (
        <Card key={q.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium leading-relaxed">
                <span className="mr-1.5 text-muted-foreground">{qi + 1}.</span>
                {q.prompt}
              </p>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  q.correct ? "bg-ws-success/10 text-ws-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                <RenderIcon icon={q.correct ? CheckIcon : XIcon} size={12} />
                {q.correct
                  ? `Right · ${q.points} pt${q.points === 1 ? "" : "s"}`
                  : q.chosen.length === 0
                    ? "Not answered"
                    : "Wrong"}
              </span>
            </div>
            <ul className="space-y-1.5">
              {q.options.map((opt) => {
                const chosen = q.chosen.includes(opt.id)
                const tone = optionTone(q, opt.id)
                const isKey = q.correctOptionIds?.includes(opt.id) ?? false
                return (
                  <li
                    key={opt.id}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${OPTION_TONE_CLASS[tone]}`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                        q.type === "single" ? "rounded-full" : "rounded"
                      } ${chosen ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}
                    >
                      {chosen && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                    <span className="min-w-0 flex-1">{opt.text}</span>
                    {(chosen || isKey) && (
                      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right text-[10px] leading-tight">
                        {chosen && <span className="text-muted-foreground">Your answer</span>}
                        {isKey && <span className="font-semibold text-ws-success">Correct answer</span>}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </section>
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
    // 2026-11-12: a thrown call (offline, a tab left open across a deploy) said nothing.
    onError: () => setStartError("We couldn't reach the server. Check your connection, or reload the page."),
  })

  // 2026-11-12: reopen the latest finished attempt, marked (the result screen was the only place it showed).
  const lastReview = useMutation({
    mutationFn: () => getLastExamResult(courseId, lessonId),
    onSuccess: (res) => {
      if (res.success) {
        setStartError(null)
        setResult(res.result)
      } else {
        setStartError(res.error)
      }
    },
    onError: () => setStartError("We couldn't reach the server. Check your connection, or reload the page."),
  })

  const finish = (r: ExamResult) => {
    setRunner(null)
    setResult(r)
    queryClient.invalidateQueries({ queryKey: [...queryKeys.examStatus(courseId), lessonId ?? "final"] })
    queryClient.invalidateQueries({ queryKey: ["enrollments"] })
  }

  return (
    <>
      <Topbar breadcrumbOverrides={status ? { [courseId]: status.courseTitle } : undefined} />
      <div className="p-4 sm:p-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
        {runner ? (
          <ExamRunner runner={runner} onFinished={finish} />
        ) : result ? (
          /* ── Result screen ── */
          // 2026-11-12: wider, for the marked paper under the score card. Was:
          // <div className="max-w-md mx-auto pt-8">
          <div className="max-w-2xl mx-auto pt-8 space-y-6">
            <Card className="max-w-md mx-auto w-full">
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
            <ExamReview result={result} />
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

                {status.reviewAvailable && !status.activeAttemptId && !status.packageLock && (
                  <div className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={lastReview.isPending}
                      onClick={() => lastReview.mutate()}
                    >
                      {lastReview.isPending
                        ? "Loading…"
                        : `Review your last attempt${
                            status.lastResult?.scorePercent != null ? ` (${status.lastResult.scorePercent}%)` : ""
                          }`}
                    </Button>
                  </div>
                )}

                {status.packageLock ? (
                  <PackageLockNotice
                    title="Not included in your plan"
                    requiredLabel={status.packageLock.requiredLabel}
                  />
                ) : !status.eligible ? (
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
                    {/* 2026-11-12: a learner back on a final they had passed was offered only
                        "Take again" — the certificate it opened was nowhere on the page. */}
                    {!lessonId && status.examPassed && !status.activeAttemptId && (
                      <Button className="w-full" render={<Link href={`/dashboard/courses/${courseId}/certificate`} />}>
                        View certificate
                      </Button>
                    )}
                    <Button
                      variant={!lessonId && status.examPassed && !status.activeAttemptId ? "outline" : "default"}
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
