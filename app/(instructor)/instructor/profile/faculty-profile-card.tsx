"use client"

import { useState, useTransition } from "react"
import { CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FacultyProfileFields } from "@/components/faculty/faculty-profile-fields"
import { updateFacultyProfile } from "@/lib/actions/profile"
import type { CountryOption } from "@/lib/countries"
import type { FacultyProfileForm } from "@/lib/faculty"

/**
 * The instructor's own faculty profile (spec §10) — what /faculty/[username]
 * shows once they teach a published program.
 */
export function FacultyProfileCard({
  initial,
  countries,
}: {
  initial: FacultyProfileForm
  countries: CountryOption[]
}) {
  const [value, setValue] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateFacultyProfile(value)
      if (result.success) {
        // Show what was stored: the server normalizes (e.g. https:// on a bare LinkedIn link).
        setValue(result.data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Faculty profile</CardTitle>
        <CardDescription>Shown on your public faculty page once you teach a published program.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FacultyProfileFields
          value={value}
          onChange={setValue}
          countries={countries}
          idPrefix="faculty"
          disabled={pending}
        />
        {error && <p className="text-xs text-ws-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save faculty profile"}
          </Button>
          {saved && (
            <p className="flex items-center gap-1 text-xs text-ws-success">
              <CheckIcon size={14} aria-hidden />
              Faculty profile updated
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
