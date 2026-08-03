"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, CircleCheck } from "lucide-react"
import { markLessonComplete } from "@/lib/actions/student"

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
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markLessonComplete(courseId, lessonId)
          router.refresh()
        })
      }
      className="inline-flex items-center gap-1.5 rounded-sm bg-ws-brand px-3 py-1.5 text-xs font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 disabled:opacity-60"
    >
      <Check className="h-3.5 w-3.5" />
      {isPending ? "Saving…" : "Mark as complete"}
    </button>
  )
}
