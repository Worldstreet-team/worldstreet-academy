"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import {
  FileText,
  GripVertical,
  Plus,
  Trash2,
  Video,
  type LucideIcon,
} from "lucide-react"
import type { Lesson } from "@/lib/types"
import {
  addLesson,
  deleteLesson,
  type CourseFormState,
} from "@/lib/actions/instructor"

const initialState: CourseFormState = {
  success: false,
  error: null,
  fieldErrors: {},
}

const typeIcons: Record<string, LucideIcon> = {
  video: Video,
  text: FileText,
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

export function LessonManager({
  courseId,
  lessons,
}: {
  courseId: string
  lessons: Lesson[]
}) {
  const [state, formAction, isPending] = useActionState(addLesson, initialState)
  const [lessonType, setLessonType] = useState("video")
  const [dialogOpen, setDialogOpen] = useState(false)

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
          {lessons
            .sort((a, b) => a.order - b.order)
            .map((lesson, index) => {
              const TypeIcon = typeIcons[lesson.type] ?? FileText
              return (
                <div
                  key={lesson.id}
                  className="rounded-lg border border-ws-hairline bg-ws-surface p-3 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex shrink-0 items-center gap-2 text-ws-subtle">
                      <GripVertical size={14} strokeWidth={2} />
                      <span className="w-5 text-center tabular-nums text-xs tabular-nums">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ws-raised">
                      <TypeIcon size={14} strokeWidth={2} className="text-ws-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ws-primary">
                        {lesson.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-ws-muted">
                        <span className="rounded-full bg-ws-chip px-1.5 py-px text-[9px] font-medium capitalize">
                          {lesson.type}
                        </span>
                        {lesson.duration && <span className="tabular-nums">{lesson.duration} min</span>}
                        {lesson.isFree && (
                          <span className="rounded-full border border-ws-hairline px-1.5 py-px text-[9px] font-medium">
                            Free Preview
                          </span>
                        )}
                      </div>
                    </div>
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
                    <DeleteLessonButton
                      courseId={courseId}
                      lessonId={lesson.id}
                      lessonTitle={lesson.title}
                    />
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Add Lesson Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" className="w-full border-dashed" />
          }
        >
          <Plus size={16} strokeWidth={2} />
          Add Lesson
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Lesson</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="courseId" value={courseId} />

            <div className="space-y-1.5">
              <Label htmlFor="lesson-title">Title</Label>
              <Input
                id="lesson-title"
                name="title"
                placeholder="e.g. Understanding Blockchain"
                required
              />
              {state.fieldErrors.title && (
                <p className="text-xs text-ws-danger">
                  {state.fieldErrors.title}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lesson-description">Description</Label>
              <Textarea
                id="lesson-description"
                name="description"
                placeholder="Brief overview of this lesson"
                className="min-h-16"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  name="type"
                  defaultValue="video"
                  onValueChange={(val) => setLessonType(val ?? "video")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lesson-duration">Duration (min)</Label>
                <Input
                  id="lesson-duration"
                  name="duration"
                  type="number"
                  min="1"
                  placeholder="15"
                />
              </div>
            </div>

            {lessonType === "video" && (
              <div className="space-y-1.5">
                <Label htmlFor="lesson-video">Video URL</Label>
                <Input
                  id="lesson-video"
                  name="videoUrl"
                  type="url"
                  placeholder="https://..."
                />
                {state.fieldErrors.videoUrl && (
                  <p className="text-xs text-ws-danger">
                    {state.fieldErrors.videoUrl}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="lesson-free"
                name="isFree"
                value="true"
                className="rounded"
              />
              <Label htmlFor="lesson-free" className="font-normal">
                Free preview (available to non-enrolled students)
              </Label>
            </div>

            <div className="h-px bg-ws-hairline" />

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-ws-brand text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:bg-ws-brand hover:opacity-90"
              >
                {isPending ? "Adding..." : "Add Lesson"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
