"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserPlusIcon } from "@/components/icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  adminAddTeachingFaculty,
  adminListTeachingFaculty,
  adminRemoveTeachingFaculty,
  type TeachingFacultyMember,
} from "@/lib/actions/admin-courses"

/*
 * A program's teaching faculty on its admin edit page (owner, 2026-10-19).
 * Assigned faculty run the program's classes, mentorship and grading
 * (lib/teaching.ts); ownership and the sales share stay with its owner.
 */

const SECTION = "rounded-[20px] border border-ws-hairline bg-ws-surface p-5"

export function TeachingFacultyCard({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const queryClient = useQueryClient()
  const queryKey = ["admin", "teaching-faculty", courseId] as const
  const [email, setEmail] = React.useState("")
  const [addError, setAddError] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState<TeachingFacultyMember | null>(null)
  const [removeError, setRemoveError] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey, queryFn: () => adminListTeachingFaculty(courseId) })
  const refresh = () => queryClient.invalidateQueries({ queryKey })

  const add = useMutation({
    mutationFn: (value: string) => adminAddTeachingFaculty(courseId, value),
    onSuccess: (res) => {
      if (!res.success) {
        setAddError(res.error)
        return
      }
      setAddError(null)
      setEmail("")
      void refresh()
    },
    onError: () => setAddError("Couldn't add them to this program"),
  })

  const remove = useMutation({
    mutationFn: (member: TeachingFacultyMember) => adminRemoveTeachingFaculty(courseId, member.id),
    onSuccess: (res) => {
      if (!res.success) {
        setRemoveError(res.error)
        return
      }
      setRemoveError(null)
      setRemoving(null)
      void refresh()
    },
    onError: () => setRemoveError("Couldn't remove them from this program"),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || add.isPending) return
    setAddError(null)
    add.mutate(email)
  }

  const members = data?.success ? data.data : []

  return (
    <section aria-labelledby="teaching-faculty-heading" className={SECTION}>
      <h2 id="teaching-faculty-heading" className="text-sm font-semibold">
        Teaching faculty · <span className="tabular-nums">{data?.success ? members.length : "—"}</span>
      </h2>
      <p className="mt-1 text-[13px] text-ws-muted">
        Assigned faculty run this program&apos;s classes, mentorship and grading. The program&apos;s owner and its sales
        share don&apos;t change.
      </p>

      <div className="mt-3 divide-y divide-ws-hairline">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="my-2 h-12 rounded-lg" />)
        ) : data && !data.success ? (
          <p className="py-3 text-sm text-ws-danger">{data.error}</p>
        ) : members.length === 0 ? (
          <p className="py-3 text-sm text-ws-muted">No faculty assigned yet.</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                  <AvatarFallback className="bg-ws-chip text-[11px] text-ws-primary">
                    {m.name[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-ws-muted">{m.email}</p>
                </div>
                {!m.teaching && (
                  <Badge variant="outline" className="text-[10px]">
                    Not faculty · not teaching
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRemoveError(null)
                  setRemoving(m)
                }}
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor="teaching-faculty-email">Faculty email</Label>
          <Input
            id="teaching-faculty-email"
            type="text"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="h-10 text-sm"
          />
        </div>
        <Button type="submit" variant="outline" disabled={add.isPending || !email.trim()}>
          <UserPlusIcon size={16} aria-hidden />
          {add.isPending ? "Adding…" : "Add"}
        </Button>
      </form>
      {addError && (
        <p role="alert" className="mt-2 text-xs text-ws-danger">
          {addError}
        </p>
      )}

      <Dialog open={removing !== null} onOpenChange={(open) => !open && !remove.isPending && setRemoving(null)}>
        <DialogContent>
          {removing && (
            <>
              <DialogHeader>
                <DialogTitle>{`Remove ${removing.name} from ${courseTitle}?`}</DialogTitle>
                <DialogDescription>
                  They stop teaching it straight away: its classes, mentorship, grading and students leave their
                  dashboard, and they&apos;re told. You can add them again later.
                </DialogDescription>
              </DialogHeader>
              {removeError && <p className="text-xs text-ws-danger">{removeError}</p>}
              <DialogFooter>
                <Button variant="outline" size="sm" disabled={remove.isPending} onClick={() => setRemoving(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(removing)}
                >
                  {remove.isPending ? "Removing…" : "Remove"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
