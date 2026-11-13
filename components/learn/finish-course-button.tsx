"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { getStudentExamStatus } from "@/lib/actions/exams"
import { markCourseComplete, markLessonComplete } from "@/lib/actions/student"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { useInvalidateEnrollments } from "@/lib/hooks/queries/use-enrollments"

interface FinishCourseButtonProps {
  courseId: string
  /** The open, not-yet-completed lesson on screen — marked done before finishing. */
  pendingLessonId?: string | null
}

export function FinishCourseButton({
  courseId,
  pendingLessonId = null,
}: FinishCourseButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const invalidateEnrollments = useInvalidateEnrollments()

  // Exam-required courses route to the final exam instead of the celebration
  // page — completion is withheld until a passing attempt anyway.
  const { data: examStatus } = useQuery({
    queryKey: queryKeys.examStatus(courseId),
    queryFn: () => getStudentExamStatus(courseId),
    staleTime: 30_000,
  })

  const needsExam = !!examStatus?.examRequired && !examStatus.examPassed

  // The completion mutation runs HERE, on an explicit click — never as a
  // side effect of rendering the /completed page (link prefetch used to mark
  // courses complete). The celebration page is read-only.
  const handleFinish = () => {
    setError(null)
    startTransition(async () => {
      if (needsExam) {
        router.push(`/dashboard/courses/${courseId}/exam`)
        return
      }
      // 2026-11-12: a thrown call (offline, a tab left open across a deploy)
      // reached the error boundary; now it says so here.
      try {
        // Finishing requires every open lesson done; the one on screen counts as
        // read once the student clicks Finish.
        if (pendingLessonId) await markLessonComplete(courseId, pendingLessonId)
        const res = await markCourseComplete(courseId)
        void invalidateEnrollments()
        if (res.success && res.requiresExam) {
          router.push(`/dashboard/courses/${courseId}/exam`)
        } else if (res.success) {
          router.push(`/dashboard/courses/${courseId}/completed`)
        } else {
          // 2026-11-12: the course page sends an enrolled learner straight back
          // to the player, so this bounced them with no word of what was missing.
          // router.push(`/dashboard/courses/${courseId}`)
          setError(res.error ?? "We couldn't finish the program. Please try again.")
        }
      } catch {
        setError("We couldn't reach the server. Check your connection, or reload the page.")
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={isPending} onClick={handleFinish}>
        {isPending
          ? "Finishing…"
          : needsExam
            ? "Take Final Exam →"
            : "Finish Course →"}
      </Button>
      {error && (
        <p role="alert" className="max-w-56 text-right text-[11px] leading-snug text-ws-danger">
          {error}
        </p>
      )}
    </div>
  )
}
