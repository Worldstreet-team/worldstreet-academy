"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getStudentExamStatus } from "@/lib/actions/exams"
import { queryKeys } from "@/lib/hooks/queries/keys"
import { CircleCheckBigIcon, ClockIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

/**
 * Knowledge-check card under a lesson — renders only when the lesson has a
 * published quiz. Practice-only: never gates lesson/course completion.
 */
export function LessonQuizCard({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { data: status } = useQuery({
    queryKey: [...queryKeys.examStatus(courseId), lessonId],
    queryFn: () => getStudentExamStatus(courseId, lessonId),
    staleTime: 30_000,
  })

  if (!status?.hasExam) return null

  const passed = status.examPassed

  return (
    <div
      className={`rounded-lg border p-4 flex items-center justify-between gap-3 flex-wrap ${
        passed ? "border-ws-success/30 bg-ws-success/5" : "border-primary/25 bg-primary/[0.04]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
            passed ? "bg-ws-success/10 text-ws-success" : "bg-primary/10 text-primary"
          }`}
        >
          <RenderIcon icon={passed ? CircleCheckBigIcon : ClockIcon}  size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">
              {status.title || "Test your knowledge"}
            </p>
            <Badge variant="secondary" className="text-[9px]">knowledge check</Badge>
            {passed && (
              <Badge className="text-[9px] bg-ws-success hover:bg-ws-success/90">
                passed{status.bestScorePercent != null ? ` · ${status.bestScorePercent}%` : ""}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {status.questionCount} question{status.questionCount === 1 ? "" : "s"} ·{" "}
            {status.durationMinutes} min · practice only — doesn&apos;t affect your progress
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={passed ? "outline" : "default"}
        render={<Link href={`/dashboard/courses/${courseId}/exam?lesson=${lessonId}`} />}
      >
        {status.activeAttemptId ? "Resume quiz" : passed ? "Retake quiz" : "Take quiz"}
      </Button>
    </div>
  )
}
