"use client"

import Link from "next/link"
import { Award, BookOpen, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ArtCertificate } from "@/components/shared/illustrations"
import { CourseRating, type OwnReview } from "@/components/learn/course-rating"
import type { CourseRatingSummary } from "@/lib/actions/reviews"

interface CourseCompletionClientProps {
  courseTitle: string
  courseId: string
  /** False when the package has no certificate (Basic) — no certificate actions. */
  hasCertificate: boolean
  ratingSummary: CourseRatingSummary | null
  /** The learner's own review, when they've left one. */
  review: OwnReview | null
}

export function CourseCompletionClient({
  courseTitle,
  courseId,
  hasCertificate,
  ratingSummary,
  review,
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

        {/* The moment a learner can best judge the whole program. */}
        <CourseRating
          courseId={courseId}
          courseTitle={courseTitle}
          currentRating={ratingSummary?.average}
          ratingCount={ratingSummary?.count}
          review={review}
        />

        {/* Action Buttons */}
        {/* Gold stays on the one primary action: the certificate when the
            package includes one, otherwise the way back to the course. */}
        <div className="space-y-3 pt-4">
          {hasCertificate && (
            <Button
              size="lg"
              className="w-full gap-2"
              render={<Link href={`/dashboard/courses/${courseId}/certificate`} />}
            >
              <Award className="h-5 w-5" />
              View Certificate
            </Button>
          )}

          <Button
            variant={hasCertificate ? "outline" : "default"}
            size="lg"
            className="w-full gap-2"
            render={<Link href={`/dashboard/courses/${courseId}`} />}
          >
            <BookOpen className="h-5 w-5" />
            Back to Course
          </Button>

          {hasCertificate && (
            <Button
              variant="ghost"
              size="lg"
              className="w-full gap-2 text-ws-muted hover:text-ws-primary"
              render={<Link href="/dashboard/certificates" />}
            >
              <GraduationCap className="h-5 w-5" />
              All My Certificates
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
