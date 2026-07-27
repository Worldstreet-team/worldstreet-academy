"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { getStudentExamStatus } from "@/lib/actions/exams"
import { queryKeys } from "@/lib/hooks/queries/keys"

interface FinishCourseButtonProps {
  courseId: string
}

export function FinishCourseButton({
  courseId,
}: FinishCourseButtonProps) {
  // Exam-required courses route to the final exam instead of the celebration
  // page — completion is withheld until a passing attempt anyway.
  const { data: examStatus } = useQuery({
    queryKey: queryKeys.examStatus(courseId),
    queryFn: () => getStudentExamStatus(courseId),
    staleTime: 30_000,
  })

  const needsExam = !!examStatus?.examRequired && !examStatus.examPassed

  return (
    <Button
      size="sm"
      variant="outline"
      render={
        <Link
          href={
            needsExam
              ? `/dashboard/courses/${courseId}/exam`
              : `/dashboard/courses/${courseId}/completed`
          }
        />
      }
    >
      {needsExam ? "Take Final Exam →" : "Finish Course →"}
    </Button>
  )
}
