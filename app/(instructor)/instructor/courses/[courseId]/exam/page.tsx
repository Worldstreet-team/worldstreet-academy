"use client"

import * as React from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Topbar } from "@/components/platform/topbar"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getCourseExamForInstructor,
  upsertExam,
  addExamQuestion,
  updateExamQuestion,
  deleteExamQuestion,
  setExamPublished,
  setCourseExamRequired,
  type InstructorQuestion,
  type QuestionInput,
} from "@/lib/actions/exams"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { CheckIcon, PlusIcon, SquarePenIcon, Trash2Icon, XIcon } from "lucide-react"

/* ── Question editor dialog ── */

function QuestionDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
  error,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: InstructorQuestion | null
  onSave: (input: QuestionInput) => void
  saving: boolean
  error: string | null
}) {
  const [type, setType] = React.useState<"single" | "multi">("single")
  const [prompt, setPrompt] = React.useState("")
  const [options, setOptions] = React.useState<string[]>(["", ""])
  const [correct, setCorrect] = React.useState<number[]>([])
  const [points, setPoints] = React.useState("1")

  React.useEffect(() => {
    if (open) {
      setType(initial?.type ?? "single")
      setPrompt(initial?.prompt ?? "")
      setOptions(initial ? initial.options.map((o) => o.text) : ["", ""])
      setCorrect(
        initial
          ? initial.options
              .map((o, i) => (initial.correctOptionIds.includes(o.id) ? i : -1))
              .filter((i) => i >= 0)
          : []
      )
      setPoints(String(initial?.points ?? 1))
    }
  }, [open, initial])

  const toggleCorrect = (index: number) => {
    setCorrect((prev) => {
      if (type === "single") return [index]
      return prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit question" : "Add question"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            {(["single", "multi"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t)
                  if (t === "single" && correct.length > 1) setCorrect(correct.slice(0, 1))
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  type === t
                    ? "bg-foreground text-background border-foreground"
                    : "border-ws-hairline text-ws-muted hover:bg-ws-raised"
                }`}
              >
                {t === "single" ? "Single choice" : "Multiple answers"}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <label className="text-[11px] text-ws-muted">Points</label>
              <Input
                inputMode="numeric"
                className="h-7 w-14 text-xs"
                value={points}
                onChange={(e) => setPoints(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Question prompt…"
            className="min-h-20 text-sm"
          />

          <div className="space-y-1.5">
            <p className="text-[11px] text-ws-muted">
              Options — tick the correct one{type === "multi" ? "s" : ""}.
            </p>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Mark option ${i + 1} correct`}
                  onClick={() => toggleCorrect(i)}
                  className={`h-5 w-5 shrink-0 border flex items-center justify-center transition-colors ${
                    type === "single" ? "rounded-full" : "rounded"
                  } ${
                    correct.includes(i)
                      ? "border-ws-success bg-ws-success text-white"
                      : "border-ws-muted/40 hover:border-ws-primary"
                  }`}
                >
                  {correct.includes(i) && <CheckIcon size={10} />}
                </button>
                <Input
                  value={opt}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  placeholder={`Option ${i + 1}`}
                  className="h-11 text-base md:h-8 md:text-xs"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    aria-label="Remove option"
                    className="text-ws-muted/60 hover:text-destructive"
                    onClick={() => {
                      setOptions((prev) => prev.filter((_, j) => j !== i))
                      setCorrect((prev) =>
                        prev.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c))
                      )
                    }}
                  >
                    <XIcon  size={14} />
                  </button>
                )}
              </div>
            ))}
            {options.length < 8 && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setOptions((prev) => [...prev, ""])}
              >
                <PlusIcon  size={12} /> Add option
              </Button>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={() =>
              onSave({
                type,
                prompt,
                options,
                correctIndexes: correct,
                points: Number(points) || 1,
              })
            }
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Add question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Page ── */

export default function InstructorExamPage() {
  return (
    <React.Suspense fallback={null}>
      <InstructorExamPageInner />
    </React.Suspense>
  )
}

function InstructorExamPageInner() {
  const params = useParams<{ courseId: string }>()
  const courseId = params.courseId
  const search = useSearchParams()
  // ?lesson=<id> switches the builder to that lesson's knowledge check.
  const lessonId = search.get("lesson")
  const queryClient = useQueryClient()

  const { data: exam, isLoading } = useQuery({
    queryKey: [...queryKeys.courseExam(courseId), lessonId ?? "final"],
    queryFn: () => getCourseExamForInstructor(courseId, lessonId),
  })

  const [title, setTitle] = React.useState("")
  const [instructions, setInstructions] = React.useState("")
  const [duration, setDuration] = React.useState("30")
  const [passMark, setPassMark] = React.useState("70")
  const [maxAttempts, setMaxAttempts] = React.useState("3")
  const [shuffleQuestions, setShuffleQuestions] = React.useState(true)
  const [shuffleOptions, setShuffleOptions] = React.useState(true)
  const [settingsError, setSettingsError] = React.useState<string | null>(null)
  const [savedFlash, setSavedFlash] = React.useState(false)

  const [qDialogOpen, setQDialogOpen] = React.useState(false)
  const [editingQuestion, setEditingQuestion] = React.useState<InstructorQuestion | null>(null)
  const [qError, setQError] = React.useState<string | null>(null)
  const [toggleError, setToggleError] = React.useState<string | null>(null)

  // Hydrate form from the loaded exam
  React.useEffect(() => {
    if (exam) {
      setTitle(exam.title)
      setInstructions(exam.instructions)
      setDuration(String(exam.settings.durationMinutes))
      setPassMark(String(exam.settings.passMarkPercent))
      setMaxAttempts(String(exam.settings.maxAttempts))
      setShuffleQuestions(exam.settings.shuffleQuestions)
      setShuffleOptions(exam.settings.shuffleOptions)
    }
  }, [exam])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [...queryKeys.courseExam(courseId), lessonId ?? "final"] })

  const save = useMutation({
    mutationFn: () =>
      upsertExam(courseId, {
        title,
        instructions,
        lessonId,
        settings: {
          durationMinutes: Math.min(240, Math.max(5, Number(duration) || 30)),
          passMarkPercent: Math.min(100, Math.max(1, Number(passMark) || 70)),
          maxAttempts: Math.min(20, Math.max(0, Number(maxAttempts) || 0)),
          shuffleQuestions,
          shuffleOptions,
        },
      }),
    onSuccess: (res) => {
      if (!res.success) setSettingsError(res.error ?? "Failed")
      else {
        setSettingsError(null)
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
      }
      invalidate()
    },
  })

  const saveQuestion = useMutation({
    mutationFn: (input: QuestionInput) =>
      editingQuestion
        ? updateExamQuestion(courseId, editingQuestion.id, input, lessonId)
        : addExamQuestion(courseId, input, lessonId),
    onSuccess: (res) => {
      if (!res.success) {
        setQError(res.error ?? "Failed")
      } else {
        setQError(null)
        setQDialogOpen(false)
        setEditingQuestion(null)
      }
      invalidate()
    },
  })

  const removeQuestion = useMutation({
    mutationFn: (questionId: string) => deleteExamQuestion(courseId, questionId, lessonId),
    onSuccess: invalidate,
  })

  const publish = useMutation({
    mutationFn: (published: boolean) => setExamPublished(courseId, published, lessonId),
    onSuccess: (res) => {
      setToggleError(res.success ? null : (res.error ?? "Failed"))
      invalidate()
    },
  })

  const requireExam = useMutation({
    mutationFn: (required: boolean) => setCourseExamRequired(courseId, required),
    onSuccess: (res) => {
      setToggleError(res.success ? null : (res.error ?? "Failed"))
      invalidate()
    },
  })

  return (
    <>
      <Topbar title={lessonId ? "Lesson Quiz" : "Course Exam"} variant="instructor" />
      <div className="flex-1 px-4 sm:px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader
          title={lessonId ? "Lesson knowledge check" : "Course exam (CBT)"}
          subline={
            lessonId
              ? "Short practice quiz shown to students on this lesson — never gates the certificate."
              : "Timed multiple-choice exam — optionally required for the certificate."
          }
          action={
            exam ? (
              <div className="flex items-center gap-2">
                <Badge variant={exam.status === "published" ? "default" : "outline"}>
                  {exam.status}
                </Badge>
                {exam.examRequired && <Badge variant="secondary">required</Badge>}
              </div>
            ) : undefined
          }
        />

        {isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : (
          <>
            {/* Settings */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium">Exam title</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Final assessment"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium">Instructions (optional)</label>
                    <Textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="What should students know before starting?"
                      className="min-h-16 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Duration (minutes)</label>
                    <Input
                      inputMode="numeric"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ""))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Pass mark (%)</label>
                    <Input
                      inputMode="numeric"
                      value={passMark}
                      onChange={(e) => setPassMark(e.target.value.replace(/[^0-9]/g, ""))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Max attempts (0 = unlimited)</label>
                    <Input
                      inputMode="numeric"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value.replace(/[^0-9]/g, ""))}
                    />
                  </div>
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center justify-between text-xs font-medium">
                      Shuffle questions
                      <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
                    </label>
                    <label className="flex items-center justify-between text-xs font-medium">
                      Shuffle options
                      <Switch checked={shuffleOptions} onCheckedChange={setShuffleOptions} />
                    </label>
                  </div>
                </div>
                {settingsError && <p className="text-xs text-destructive">{settingsError}</p>}
                <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                  {save.isPending ? "Saving…" : savedFlash ? "Saved" : exam ? "Save settings" : "Create exam"}
                </Button>
              </CardContent>
            </Card>

            {/* Questions */}
            {exam && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                      Questions{" "}
                      <span className="text-ws-muted font-normal">
                        ({exam.questionCount} · {exam.totalPoints} points)
                      </span>
                    </h2>
                    <Button
                      size="xs"
                      onClick={() => {
                        setEditingQuestion(null)
                        setQError(null)
                        setQDialogOpen(true)
                      }}
                    >
                      <PlusIcon  size={12} /> Add question
                    </Button>
                  </div>

                  {exam.questions.length === 0 ? (
                    <p className="text-xs text-ws-muted py-6 text-center">
                      No questions yet — add your first one.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {exam.questions.map((q, i) => (
                        <div
                          key={q.id}
                          className="rounded-lg border border-ws-hairline px-3 py-2.5 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium leading-relaxed">
                              {i + 1}. {q.prompt}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className="text-[9px]">
                                {q.points}pt{q.type === "multi" ? " · multi" : ""}
                              </Badge>
                              <button
                                type="button"
                                aria-label="Edit question"
                                className="text-ws-muted hover:text-foreground p-1"
                                onClick={() => {
                                  setEditingQuestion(q)
                                  setQError(null)
                                  setQDialogOpen(true)
                                }}
                              >
                                <SquarePenIcon  size={13} />
                              </button>
                              <button
                                type="button"
                                aria-label="Delete question"
                                className="text-ws-muted hover:text-destructive p-1"
                                onClick={() => removeQuestion.mutate(q.id)}
                              >
                                <Trash2Icon  size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {q.options.map((o) => (
                              <Badge
                                key={o.id}
                                variant={q.correctOptionIds.includes(o.id) ? "default" : "outline"}
                                className="text-[9px] font-normal"
                              >
                                {q.correctOptionIds.includes(o.id) && (
                                  <CheckIcon size={9} className="mr-0.5 shrink-0" />
                                )}
                                {o.text.length > 40 ? o.text.slice(0, 40) + "…" : o.text}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Publish + require */}
            {exam && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold">Published</p>
                      <p className="text-[11px] text-ws-muted">
                        Students can see and take the exam.
                      </p>
                    </div>
                    <Switch
                      checked={exam.status === "published"}
                      onCheckedChange={(v) => publish.mutate(v)}
                      disabled={publish.isPending}
                    />
                  </div>
                  {!lessonId && (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-ws-hairline">
                    <div>
                      <p className="text-xs font-semibold">Required for certificate</p>
                      <p className="text-[11px] text-ws-muted">
                        Students must pass before the course counts as completed. Applies to
                        completions from now on — already-completed students keep their
                        certificates.
                      </p>
                    </div>
                    <Switch
                      checked={exam.examRequired}
                      onCheckedChange={(v) => requireExam.mutate(v)}
                      disabled={requireExam.isPending || exam.status !== "published"}
                    />
                  </div>
                  )}
                  {toggleError && <p className="text-xs text-destructive">{toggleError}</p>}
                </CardContent>
              </Card>
            )}
          </>
        )}
        </div>
      </div>

      <QuestionDialog
        open={qDialogOpen}
        onOpenChange={(o) => {
          setQDialogOpen(o)
          if (!o) setEditingQuestion(null)
        }}
        initial={editingQuestion}
        onSave={(input) => saveQuestion.mutate(input)}
        saving={saveQuestion.isPending}
        error={qError}
      />
    </>
  )
}
