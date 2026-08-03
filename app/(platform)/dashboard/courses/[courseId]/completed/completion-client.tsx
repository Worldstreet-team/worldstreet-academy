"use client"

import Link from "next/link"
import { Award, BookOpen, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ArtCertificate } from "@/components/shared/illustrations"

interface CourseCompletionClientProps {
  courseTitle: string
  courseId: string
}

export function CourseCompletionClient({
  courseTitle,
  courseId,
}: CourseCompletionClientProps) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      {/* One quiet 320ms entrance — the moment is carried by the gold mark
          and typography, not by celebration effects. */}
      <div className="ws-animate-in w-full max-w-lg space-y-6 text-center">
        {/* Illustration */}
        <div className="flex justify-center">
          <ArtCertificate className="w-64 h-52" />
        </div>

        {/* Content */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ws-gold">
            Course completed
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-ws-primary">
            Congratulations
          </h1>

          <p className="text-ws-muted max-w-md mx-auto">
            You&apos;ve successfully completed{" "}
            <span className="font-semibold text-ws-primary">
              &ldquo;{courseTitle}&rdquo;
            </span>
            . You&apos;re one step closer to mastering your skills. Keep up the
            amazing work!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            size="lg"
            className="w-full gap-2"
            render={<Link href={`/dashboard/courses/${courseId}/certificate`} />}
          >
            <Award className="h-5 w-5" />
            View Certificate
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2"
            render={<Link href={`/dashboard/courses/${courseId}`} />}
          >
            <BookOpen className="h-5 w-5" />
            Back to Course
          </Button>

          <Button
            variant="ghost"
            size="lg"
            className="w-full gap-2 text-ws-muted hover:text-ws-primary"
            render={<Link href="/dashboard/certificates" />}
          >
            <GraduationCap className="h-5 w-5" />
            All My Certificates
          </Button>
        </div>
      </div>
    </div>
  )
}
