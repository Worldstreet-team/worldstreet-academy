"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle01Icon,
  BookOpen01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const courseId = searchParams.get("courseId")

  return (
    <>
      <Topbar title="Enrolled!" />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6 py-16">
          {/* Success animation circle */}
          <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center ring-8 ring-emerald-500/5">
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              size={40}
              className="text-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold">Successfully Enrolled!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You&apos;re all set. The course has been added to your library.
              Start learning at your own pace.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              className="w-full h-11 gap-2"
              size="lg"
              render={<Link href="/dashboard/my-courses" />}
            >
              <HugeiconsIcon icon={BookOpen01Icon} size={16} />
              View My Courses
            </Button>

            {courseId && (
              <Button
                variant="outline"
                className="w-full h-11 gap-2"
                size="lg"
                render={<Link href={`/dashboard/courses/${courseId}`} />}
              >
                Go to Course
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
