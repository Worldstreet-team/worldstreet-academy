"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { getStudentExamStatus } from "@/lib/actions/exams"
import { markCourseComplete } from "@/lib/actions/student"
import { queryKeys } from "@/lib/hooks/queries/keys"

interface FinishCourseButtonProps {
  courseId: string
}

export function FinishCourseButton({
  courseId,
}: FinishCourseButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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
    startTransition(async () => {
      if (needsExam) {
        router.push(`/dashboard/courses/${courseId}/exam`)
        return
      }
      const res = await markCourseComplete(courseId)
      if (res.success && res.requiresExam) {
        router.push(`/dashboard/courses/${courseId}/exam`)
      } else if (res.success) {
        router.push(`/dashboard/courses/${courseId}/completed`)
      } else {
        router.push(`/dashboard/courses/${courseId}`)
      }
    })
  }

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={handleFinish}>
      {isPending
        ? "Finishing…"
        : needsExam
          ? "Take Final Exam →"
          : "Finish Course →"}
    </Button>
  )
}
