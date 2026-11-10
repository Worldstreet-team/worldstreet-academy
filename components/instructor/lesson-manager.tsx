"use client"
import { FileText, GripVertical, Pencil, Plus, Trash2, Video, type IconComponent } from "@/components/icons"

import Link from "next/link"
import { useActionState, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { MediaUpload } from "@/components/ui/media-upload"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ArtCourses } from "@/components/shared/illustrations"

import type { PackageKey } from "@/lib/db/models"
import { PACKAGE_LABEL } from "@/lib/entitlements"
import { lessonVideoUrlError } from "@/lib/lesson-video"
import { getVideoUploadUrl } from "@/lib/actions/upload"
import {
  addLesson,
  deleteLesson,
  setLessonMinPackage,
  updateLesson,
  type CourseFormState,
  type ManagedLesson,
} from "@/lib/actions/instructor"
import { formatLength } from "@/components/programs/format"

const initialState: CourseFormState = {
  success: false,
  error: null,
  fieldErrors: {},
}

const typeIcons: Record<string, IconComponent> = {
  video: Video,
  text: FileText,
}

const TYPE_ITEMS = [
  { value: "video", label: "Recorded video" },
  { value: "text", label: "Text" },
]

/**
 * Per-row tier select — saves immediately through setLessonMinPackage. Holds
 * the choice optimistically so the trigger doesn't snap back while saving;
 * a failed save restores the previous value.
 */
function LessonTierSelect({
  courseId,
  lessonId,
  value,
  tiers,
  items,
}: {
  courseId: string
  lessonId: string
  value: PackageKey | null
  tiers: PackageKey[]
  items: ReadonlyArray<{ value: string; label: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<PackageKey | null>(value)

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Select
        items={items}
        value={current && tiers.includes(current) ? current : "everyone"}
        disabled={pending}
        onValueChange={(v) => {
          const next = v && v !== "everyone" ? (v as PackageKey) : null
          if (next === current) return
          const previous = current
          setCurrent(next)
          setError(null)
          startTransition(async () => {
            const res = await setLessonMinPackage(courseId, lessonId, next)
            if (res.success) router.refresh()
            else {
              setCurrent(previous)
              setError(res.error)
            }
          })
        }}
      >
        <SelectTrigger className="h-7 w-[9rem] text-xs" aria-label="Minimum plan">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="everyone">Everyone</SelectItem>
          {tiers.map((k) => (
            <SelectItem key={k} value={k}>
              {PACKAGE_LABEL[k]} and up
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-[10px] text-ws-danger">{error}</p>}
    </div>
  )
}

/** Simple confirm before the (unchanged) deleteLesson server action fires. */
function DeleteLessonButton({
  courseId,
  lessonId,
  lessonTitle,
}: {
  courseId: string
  lessonId: string
  lessonTitle: string
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <button
            type="button"
            aria-label={`Delete lesson “${lessonTitle}”`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-danger"
          />
        }
      >
        <Trash2 size={14} strokeWidth={2} />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete lesson?</AlertDialogTitle>
          <AlertDialogDescription>
            “{lessonTitle}” will be permanently removed from this course. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={deleteLesson}>
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="lessonId" value={lessonId} />
            <AlertDialogAction type="submit" variant="destructive">
              Delete lesson
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function FieldError({ message }: { message?: string | null }) {
  return message ? <p className="text-xs text-ws-danger">{message}</p> : null
}

/** Whole hours and the minutes left over, from seconds ("" when not stated). */
function splitLength(seconds: number | null): { hours: string; minutes: string } {
  if (!seconds || seconds <= 0) return { hours: "", minutes: "" }
  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  return { hours: String(Math.floor(totalMinutes / 60)), minutes: String(totalMinutes % 60) }
}

/**
 * The add/edit lesson form. Mounted only while its dialog is open, so every
 * opening starts from the lesson as saved. A recorded video is uploaded (or
 * linked) and its length typed as hours and minutes — an upload fills the
 * length in from the file, and the tutor can change it.
 */
function LessonForm({
  courseId,
  lesson,
  tiers,
  items,
  onDone,
}: {
  courseId: string
  lesson: ManagedLesson | null
  tiers: PackageKey[]
  items: ReadonlyArray<{ value: string; label: string }>
  onDone: () => void
}) {
  const editing = lesson !== null
  const [state, formAction, isPending] = useActionState(
    async (prev: CourseFormState, formData: FormData) => {
      const result = await (editing ? updateLesson : addLesson)(prev, formData)
      if (result.success) onDone()
      return result
    },
    initialState
  )
  const [type, setType] = useState<"video" | "text">(lesson?.type === "text" ? "text" : "video")
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? "")
  const [content, setContent] = useState(lesson?.content ?? "")
  const initialLength = splitLength(lesson?.duration ?? null)
  const [hours, setHours] = useState(initialLength.hours)
  const [minutes, setMinutes] = useState(initialLength.minutes)
  // Checked here before submitting: a refused submit would reset the form and
  // lose what the tutor typed. The server checks again.
  const [videoUrlError, setVideoUrlError] = useState<string | null>(null)
  const fieldErrors = state.fieldErrors

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (type !== "video") return
        const problem = videoUrl.trim() ? lessonVideoUrlError(videoUrl.trim()) : "Upload the video or paste its link"
        setVideoUrlError(problem)
        if (problem) e.preventDefault()
      }}
      className="space-y-4"
    >
      <input type="hidden" name="courseId" value={courseId} />
      {lesson && <input type="hidden" name="lessonId" value={lesson.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="lesson-title">Title</Label>
        <Input
          id="lesson-title"
          name="title"
          placeholder="e.g. Week 1: Understanding the market"
          defaultValue={lesson?.title ?? ""}
          maxLength={150}
          required
        />
        <FieldError message={fieldErrors.title} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lesson-description">Description</Label>
        <Textarea
          id="lesson-description"
          name="description"
          placeholder="Brief overview of this lesson"
          defaultValue={lesson?.description ?? ""}
          maxLength={2000}
          className="min-h-16"
        />
        <FieldError message={fieldErrors.description} />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select
          name="type"
          items={TYPE_ITEMS}
          value={type}
          onValueChange={(val) => setType(val === "text" ? "text" : "video")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {type === "video" ? (
        <>
          <MediaUpload
            type="video"
            label="Video file"
            value={videoUrl}
            onChange={(url) => {
              setVideoUrl(url)
              setVideoUrlError(null)
            }}
            onRemove={() => setVideoUrl("")}
            onGetPresignedUrl={(file) => getVideoUploadUrl(file.name, file.type)}
            onDurationDetected={(seconds) => {
              const length = splitLength(seconds)
              setHours(length.hours)
              setMinutes(length.minutes)
            }}
            compact
          />
          <div className="space-y-1.5">
            <Label htmlFor="lesson-video">Or paste a link to the video file</Label>
            <Input
              id="lesson-video"
              name="videoUrl"
              type="url"
              placeholder="https://… (.mp4 or .webm)"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value)
                setVideoUrlError(null)
              }}
            />
            <FieldError message={videoUrlError ?? fieldErrors.videoUrl} />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label>Lesson text</Label>
          <RichTextEditor value={content} onChange={setContent} placeholder="Write the lesson…" />
          <input type="hidden" name="content" value={content} />
          <FieldError message={fieldErrors.content} />
        </div>
      )}

      {/* The video's length, or a text lesson's reading time (the course editor's
          "Reading time" — the same stored field, so editing keeps it). */}
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-ws-primary">{type === "video" ? "Video length" : "Reading time"}</legend>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Hours"
            name="lengthHours"
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            placeholder="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-20 tabular-nums"
          />
          <span className="text-sm text-ws-muted">hours</span>
          <Input
            aria-label="Minutes"
            name="lengthMinutes"
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            placeholder="0"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-20 tabular-nums"
          />
          <span className="text-sm text-ws-muted">minutes</span>
        </div>
        <p className="text-[11px] text-ws-muted">
          {type === "video" ? (
            <>
              How long the recorded video runs. Uploading fills this in from the file; change it if it&apos;s wrong.
              Leave it empty if you don&apos;t know yet — the program page then leaves this lesson out of its video total.
            </>
          ) : (
            "About how long the lesson takes to read. Optional."
          )}
        </p>
        <FieldError message={fieldErrors.lengthHours ?? fieldErrors.lengthMinutes} />
      </fieldset>

      {tiers.length > 0 && (
        <div className="space-y-1.5">
          <Label>Minimum plan</Label>
          <Select
            name="minPackageKey"
            defaultValue={lesson?.minPackageKey && tiers.includes(lesson.minPackageKey) ? lesson.minPackageKey : "everyone"}
            items={items}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              {tiers.map((k) => (
                <SelectItem key={k} value={k}>
                  {PACKAGE_LABEL[k]} and up
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="lesson-free"
          name="isFree"
          value="true"
          defaultChecked={lesson?.isFree ?? false}
          className="rounded"
        />
        <Label htmlFor="lesson-free" className="font-normal">
          Free preview (available to non-enrolled students)
        </Label>
      </div>

      <div className="h-px bg-ws-hairline" />

      {state.error && (
        <p role="alert" className="text-sm text-ws-danger">
          {state.error}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-ws-brand text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:bg-ws-brand hover:opacity-90"
        >
          {isPending ? "Saving…" : editing ? "Save lesson" : "Add Lesson"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** "Add Lesson" (lesson = null) or a row's "Edit", each with its own dialog. */
function LessonDialog({
  courseId,
  lesson,
  tiers,
  items,
}: {
  courseId: string
  lesson: ManagedLesson | null
  tiers: PackageKey[]
  items: ReadonlyArray<{ value: string; label: string }>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {lesson ? (
        <DialogTrigger
          render={
            <button
              type="button"
              aria-label={`Edit lesson “${lesson.title}”`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised hover:text-ws-primary"
            />
          }
        >
          <Pencil size={14} strokeWidth={2} />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" className="w-full border-dashed" />}>
          <Plus size={16} strokeWidth={2} />
          Add Lesson
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lesson ? "Edit lesson" : "Add New Lesson"}</DialogTitle>
        </DialogHeader>
        {open && (
          <LessonForm
            courseId={courseId}
            lesson={lesson}
            tiers={tiers}
            items={items}
            onDone={() => {
              // Saved: close, so the list behind the dialog shows the change.
              setOpen(false)
              router.refresh()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export function LessonManager({
  courseId,
  lessons,
  tiers,
  canQuiz,
}: {
  courseId: string
  lessons: ManagedLesson[]
  /** Enabled package keys in ladder order — the only tiers a lesson may require. Empty hides the tier controls. */
  tiers: PackageKey[]
  /** The lesson quizzes live in the exam editor — the course owner's and admins' only. */
  canQuiz: boolean
}) {
  const items = [
    { value: "everyone", label: "Everyone" },
    ...tiers.map((k) => ({ value: k, label: `${PACKAGE_LABEL[k]} and up` })),
  ]

  return (
    <div className="space-y-4">
      {/* Lesson List */}
      {lessons.length === 0 ? (
        <div className="rounded-lg border border-ws-hairline bg-ws-surface">
          <EmptyState
            art={<ArtCourses />}
            title="No lessons yet"
            description="Add your first lesson below to get started."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {[...lessons]
            .sort((a, b) => a.order - b.order)
            .map((lesson, index) => {
              const TypeIcon = typeIcons[lesson.type] ?? FileText
              const length = lesson.type === "video" && lesson.duration ? formatLength(lesson.duration) : null
              return (
                <div
                  key={lesson.id}
                  className="rounded-lg border border-ws-hairline bg-ws-surface p-3 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                >
                  {/* Phones: the controls take a second line, so the title keeps its room. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex shrink-0 items-center gap-2 text-ws-subtle">
                      <GripVertical size={14} strokeWidth={2} />
                      <span className="w-5 text-center tabular-nums text-xs tabular-nums">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ws-raised">
                      <TypeIcon size={14} strokeWidth={2} className="text-ws-muted" />
                    </div>
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate text-sm font-medium text-ws-primary">
                        {lesson.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-ws-muted">
                        <span className="rounded-full bg-ws-chip px-1.5 py-px text-[9px] font-medium capitalize">
                          {lesson.type}
                        </span>
                        {length ? (
                          <span className="tabular-nums">{length}</span>
                        ) : lesson.type === "video" ? (
                          <span>Length not set</span>
                        ) : null}
                        {lesson.isFree && (
                          <span className="rounded-full border border-ws-hairline px-1.5 py-px text-[9px] font-medium">
                            Free Preview
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      {tiers.length > 0 && (
                        <LessonTierSelect
                          courseId={courseId}
                          lessonId={lesson.id}
                          value={lesson.minPackageKey ?? null}
                          tiers={tiers}
                          items={items}
                        />
                      )}
                      {canQuiz && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          render={
                            <Link href={`/instructor/courses/${courseId}/exam?lesson=${lesson.id}`} />
                          }
                        >
                          Quiz
                        </Button>
                      )}
                      <LessonDialog courseId={courseId} lesson={lesson} tiers={tiers} items={items} />
                      <DeleteLessonButton
                        courseId={courseId}
                        lessonId={lesson.id}
                        lessonTitle={lesson.title}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      <LessonDialog courseId={courseId} lesson={null} tiers={tiers} items={items} />
    </div>
  )
}
