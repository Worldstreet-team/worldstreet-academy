"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitMentorshipIntake } from "@/lib/actions/enrollments"

/**
 * One-time Executive onboarding intake (D4): goals and availability go to the
 * instructor, who schedules the first session. Booking itself is Phase 7.
 */
export function MentorshipIntakeForm({ courseId }: { courseId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [goals, setGoals] = useState("")
  const [availability, setAvailability] = useState("")
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="space-y-4 rounded-lg bg-ws-surface p-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const res = await submitMentorshipIntake(courseId, { goals, availability })
          if (res.success) router.refresh()
          else setError(res.error)
        })
      }}
    >
      <div>
        <h2 className="text-sm font-semibold text-ws-primary">Tell your mentor about you</h2>
        <p className="mt-1 text-xs text-ws-muted">Your instructor uses this to plan your onboarding session.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="intake-goals">What do you want to achieve?</Label>
        <Textarea
          id="intake-goals"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          maxLength={2000}
          className="min-h-24"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="intake-availability">When are you usually available?</Label>
        <Textarea
          id="intake-availability"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          maxLength={500}
          placeholder="e.g. Weekday evenings, GMT+1"
          className="min-h-16"
          required
        />
      </div>
      {error && <p className="text-xs text-ws-danger">{error}</p>}
      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send to my mentor"}
      </Button>
    </form>
  )
}
