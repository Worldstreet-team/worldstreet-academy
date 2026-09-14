"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { FacultyProfileFields } from "@/components/faculty/faculty-profile-fields"
import {
  adminGetFacultyProfile,
  adminUpdateFacultyProfile,
  type AdminFacultyProfile,
} from "@/lib/actions/admin-users"
import { countryOptions } from "@/lib/countries"
import { queryKeys } from "@/lib/hooks/queries/keys"

/**
 * Admin edit of one user's faculty profile (spec §10) plus the `featured`
 * curation flag. The users page mounts this only while it is open, so it
 * never server-renders — country names come from the browser and cannot
 * mismatch a server render.
 */
export function FacultyProfileDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminFacultyProfile(userId),
    queryFn: () => adminGetFacultyProfile(userId),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit faculty profile</DialogTitle>
          <DialogDescription>
            {data ? `${data.name} · @${data.username}` : "What /faculty shows for this instructor."}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        ) : data ? (
          <FacultyProfileEditor profile={data} onClose={onClose} />
        ) : (
          <p className="text-sm text-ws-danger">Only instructors and admins have a faculty profile.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FacultyProfileEditor({ profile, onClose }: { profile: AdminFacultyProfile; onClose: () => void }) {
  const queryClient = useQueryClient()
  const countries = useMemo(() => countryOptions(), [])
  const [value, setValue] = useState(profile.form)
  const [featured, setFeatured] = useState(profile.featured)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => adminUpdateFacultyProfile(profile.userId, { ...value, featured }),
    onSuccess: (res) => {
      if (!res.success) {
        setError(res.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.adminFacultyProfile(profile.userId) })
      onClose()
    },
    onError: () => setError("Failed to update faculty profile"),
  })

  return (
    <>
      <div className="flex items-start justify-between gap-4 rounded-md bg-ws-sunken p-3">
        <div className="space-y-0.5">
          <Label htmlFor="admin-faculty-featured">Featured</Label>
          <p className="text-[11px] text-ws-muted">Featured faculty are listed first on /faculty and the homepage.</p>
        </div>
        <Switch
          id="admin-faculty-featured"
          checked={featured}
          onCheckedChange={(checked) => setFeatured(checked)}
          disabled={save.isPending}
        />
      </div>
      <FacultyProfileFields
        value={value}
        onChange={setValue}
        countries={countries}
        idPrefix="admin-faculty"
        disabled={save.isPending}
      />
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={() => {
            setError(null)
            save.mutate()
          }}
        >
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
      </DialogFooter>
    </>
  )
}
