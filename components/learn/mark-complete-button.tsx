"use client"
import { Check, CircleCheck } from "@/components/icons"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { markLessonComplete } from "@/lib/actions/student"
import { useInvalidateEnrollments } from "@/lib/hooks/queries/use-enrollments"

type MarkCompleteButtonProps = {
  courseId: string
  lessonId: string
  completed: boolean
}

/**
 * Manual lesson completion — the only path for text/live lessons (video
 * lessons also auto-complete on ended). Renders a gold CTA while incomplete
 * and a success chip once done.
 */
export function MarkCompleteButton({
  courseId,
  lessonId,
  completed,
}: MarkCompleteButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // The sidebar's progress card reads the enrollments cache, which
  // router.refresh() doesn't touch.
  const invalidateEnrollments = useInvalidateEnrollments()

  if (completed) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ws-success"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--ws-status-success) 12%, transparent)",
        }}
      >
        <CircleCheck className="h-3.5 w-3.5" />
        Completed
      </span>
    )
  }

  return (
    <>
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          // 2026-11-12: a refusal said nothing, and a thrown call (offline, a tab
          // left open across a deploy) reached the error boundary.
          // await markLessonComplete(courseId, lessonId)
          setError(null)
          try {
            const res = await markLessonComplete(courseId, lessonId)
            if (!res.success) {
              setError(res.error ?? "We couldn't save that. Please try again.")
              return
            }
          } catch {
            setError("We couldn't reach the server. Reload the page and try again.")
            return
          }
          void invalidateEnrollments()
          router.refresh()
        })
      }
      className="inline-flex items-center gap-1.5 rounded-sm bg-ws-brand px-3 py-1.5 text-xs font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 disabled:opacity-60"
    >
      <Check className="h-3.5 w-3.5" />
      {isPending ? "Saving…" : "Mark as complete"}
    </button>
    {error && (
      <span role="alert" className="ml-2 text-[11px] text-ws-danger">
        {error}
      </span>
    )}
    </>
  )
}
