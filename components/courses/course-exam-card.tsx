"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon, Certificate01Icon } from "@hugeicons/core-free-icons"
import { getStudentExamStatus } from "@/lib/actions/exams"
import { queryKeys } from "@/lib/hooks/queries/keys"

/**
 * Exam entry card on the course detail page — renders only for enrolled
 * students of a course that has a published exam.
 */
export function CourseExamCard({ courseId }: { courseId: string }) {
  const { data: status } = useQuery({
    queryKey: queryKeys.examStatus(courseId),
    queryFn: () => getStudentExamStatus(courseId),
    staleTime: 30_000,
  })

  if (!status?.hasExam) return null

  return (
    <Card className={status.examPassed ? "border-emerald-500/30" : "border-primary/25"}>
      <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
              status.examPassed ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
            }`}
          >
            <HugeiconsIcon icon={Certificate01Icon} size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{status.title || "Course exam"}</p>
              {status.examRequired && !status.examPassed && (
                <Badge variant="secondary" className="text-[9px]">required for certificate</Badge>
              )}
              {status.examPassed && (
                <Badge className="text-[9px] bg-emerald-600 hover:bg-emerald-600">
                  passed{status.bestScorePercent != null ? ` · ${status.bestScorePercent}%` : ""}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
              <HugeiconsIcon icon={Clock01Icon} size={11} />
              {status.questionCount} questions · {status.durationMinutes} min · pass at{" "}
              {status.passMarkPercent}%
              {!status.eligible ? ` · unlocks at 100% progress (you're at ${status.progress}%)` : ""}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={status.examPassed ? "outline" : "default"}
          render={<Link href={`/dashboard/courses/${courseId}/exam`} />}
        >
          {status.activeAttemptId
            ? "Resume exam"
            : status.examPassed
              ? "View exam"
              : status.eligible
                ? "Take exam"
                : "View details"}
        </Button>
      </CardContent>
    </Card>
  )
}
