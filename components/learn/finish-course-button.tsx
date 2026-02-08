"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

interface FinishCourseButtonProps {
  courseId: string
}

export function FinishCourseButton({
  courseId,
}: FinishCourseButtonProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      render={<Link href={`/dashboard/courses/${courseId}/completed`} />}
    >
      Finish Course →
    </Button>
  )
}
