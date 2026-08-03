"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { BookOpenIcon, ChevronRightIcon, CircleCheckIcon } from "lucide-react"

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const courseId = searchParams.get("courseId")

  return (
    <>
      <Topbar title="Enrolled!" />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6 py-16">
          {/* Success animation circle */}
          <div className="mx-auto w-20 h-20 rounded-full bg-ws-success/10 flex items-center justify-center ring-8 ring-ws-success/5">
            <CircleCheckIcon
              
              size={40}
              className="text-ws-success" />
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
              <BookOpenIcon  size={16} />
              View My Courses
            </Button>

            {courseId && (
              <Button
                variant="outline"
                className="w-full h-11 gap-2"
                size="lg"
                render={<Link href={`/dashboard/courses/${courseId}`} />}
              >
                Start Learning
                <ChevronRightIcon  size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
