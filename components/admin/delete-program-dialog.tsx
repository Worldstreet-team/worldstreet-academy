"use client"
import { Trash2 } from "@/components/icons"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { adminDeleteCourse } from "@/lib/actions/admin-courses"

/**
 * The admin list's "Delete program…": type the title to confirm (the pattern
 * of components/instructor/delete-course-dialog.tsx). The server refuses a
 * program anyone has enrolled in or paid for, and says so here.
 */
export function DeleteProgramDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: { id: string; title: string } | null
  onClose: () => void
  onDeleted: () => void
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed, so the typed title and any refusal start fresh for each program. */}
        {target && <DeleteProgramForm key={target.id} target={target} onClose={onClose} onDeleted={onDeleted} />}
      </DialogContent>
    </Dialog>
  )
}

function DeleteProgramForm({
  target,
  onClose,
  onDeleted,
}: {
  target: { id: string; title: string }
  onClose: () => void
  onDeleted: () => void
}) {
  const [confirmText, setConfirmText] = React.useState("")
  const matches = confirmText.trim() === target.title.trim()

  const remove = useMutation({
    mutationFn: () => adminDeleteCourse(target.id),
    onSuccess: (res) => {
      if (res.success) {
        onDeleted()
        onClose()
      }
    },
  })
  const error = remove.data && !remove.data.success ? remove.data.error : remove.isError ? "Failed to delete the course" : null

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (matches && !remove.isPending) remove.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>Delete “{target.title}”?</DialogTitle>
        <DialogDescription>
          This permanently deletes the program with its lessons, exam, assignments, materials and classes. It
          can&apos;t be undone. A program anyone has enrolled in or paid for can&apos;t be deleted: hide it from the
          website instead.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <label htmlFor="confirm-delete-program" className="text-xs font-medium text-ws-muted">
          Type the program title to confirm
        </label>
        <Input
          id="confirm-delete-program"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={target.title}
          autoComplete="off"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm leading-relaxed text-ws-danger">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" size="sm" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="destructive" type="submit" disabled={!matches || remove.isPending}>
          <Trash2 size={14} strokeWidth={2} />
          {remove.isPending ? "Deleting…" : "Delete program"}
        </Button>
      </DialogFooter>
    </form>
  )
}
