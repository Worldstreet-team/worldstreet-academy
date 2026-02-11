"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete01Icon,
  Video01Icon,
  TextIcon,
  DragDropIcon,
} from "@hugeicons/core-free-icons"
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

const typeIcons: Record<string, typeof Video01Icon> = {
  video: Video01Icon,
  text: TextIcon,
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
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              No lessons yet. Add your first lesson to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lessons
            .sort((a, b) => a.order - b.order)
            .map((lesson, index) => (
              <Card key={lesson.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                      <HugeiconsIcon icon={DragDropIcon} size={14} />
                      <span className="text-xs font-mono w-5 text-center">
                        {index + 1}
                      </span>
                    </div>
                    <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <HugeiconsIcon
                        icon={typeIcons[lesson.type]}
                        size={14}
                        className="text-muted-foreground"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {lesson.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge
                          variant="secondary"
                          className="text-[9px] capitalize px-1 py-0"
                        >
                          {lesson.type}
                        </Badge>
                        {lesson.duration && (
                          <span>{lesson.duration} min</span>
                        )}
                        {lesson.isFree && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            Free Preview
                          </Badge>
                        )}
                      </div>
                    </div>
                    <form action={deleteLesson}>
                      <input type="hidden" name="courseId" value={courseId} />
                      <input
                        type="hidden"
                        name="lessonId"
                        value={lesson.id}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        type="submit"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                      >
                        <HugeiconsIcon icon={Delete01Icon} size={14} />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Add Lesson Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" className="w-full border-dashed" />
          }
        >
          <HugeiconsIcon icon={Add01Icon} size={16} />
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
                <p className="text-xs text-destructive">
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
                  <p className="text-xs text-destructive">
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

            <Separator />

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding..." : "Add Lesson"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
