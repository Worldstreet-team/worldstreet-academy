"use client"
import { Trash2 } from "@/components/icons"

import * as React from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deleteCourse } from "@/lib/actions/instructor"

/**
 * Type-to-confirm deletion dialog for a course. Deleting a course throws away
 * its lessons and resources, so the destructive submit stays disabled until
 * the instructor types the exact course title.
 *
 * The mutation is the `deleteCourse` server action, invoked through a plain
 * form. It redirects on success; a course anyone has enrolled in or paid for
 * is refused, and the reason shows here.
 */
export function DeleteCourseDialog({
  courseId,
  courseTitle,
  open,
  onOpenChange,
}: {
  courseId: string
  courseTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [confirmText, setConfirmText] = React.useState("")
  const matches = confirmText.trim() === courseTitle.trim()

  React.useEffect(() => {
    if (!open) setConfirmText("")
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete course</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-ws-muted">
            This permanently deletes{" "}
            <span className="font-semibold text-ws-primary">{courseTitle}</span>{" "}
            along with its lessons and resources. This cannot be undone. A
            course anyone has enrolled in or paid for can&apos;t be deleted.
          </p>
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-delete-course"
              className="text-xs font-medium text-ws-muted"
            >
              Type the course title to confirm
            </label>
            <Input
              id="confirm-delete-course"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={courseTitle}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Mounted only while open, so a refusal doesn't outlive the dialog. */}
        <DeleteCourseForm courseId={courseId} matches={matches} />
      </DialogContent>
    </Dialog>
  )
}

function DeleteCourseForm({ courseId, matches }: { courseId: string; matches: boolean }) {
  const [state, formAction, pending] = React.useActionState(deleteCourse, null)
  return (
    <form action={formAction}>
      <input type="hidden" name="courseId" value={courseId} />
      {state?.error && (
        <p role="alert" className="mb-3 text-sm leading-relaxed text-ws-danger">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>
          Cancel
        </DialogClose>
        <Button
          type="submit"
          disabled={!matches || pending}
          className="bg-ws-danger text-white transition-opacity duration-[var(--ws-motion-fast)] hover:bg-ws-danger hover:opacity-90"
        >
          <Trash2 size={16} strokeWidth={2} />
          Delete course
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Self-contained trigger + dialog, for server-component call sites. */
export function DeleteCourseButton({
  courseId,
  courseTitle,
}: {
  courseId: string
  courseTitle: string
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button
        variant="ghost"
        className="w-full text-ws-danger hover:text-ws-danger"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={16} strokeWidth={2} />
        Delete Course
      </Button>
      <DeleteCourseDialog
        courseId={courseId}
        courseTitle={courseTitle}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
