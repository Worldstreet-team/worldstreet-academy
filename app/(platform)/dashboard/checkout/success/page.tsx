import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRightIcon, CircleCheckIcon } from "lucide-react"
import { Topbar } from "@/components/platform/topbar"
import { Button } from "@/components/ui/button"
import { BRAND } from "@/lib/brand"
import { getCheckoutConfirmation } from "@/lib/actions/enrollments"
import { MentorshipIntakeForm } from "@/components/checkout/mentorship-intake-form"

/** Spec §12/§17 "Enrollment confirmed" — server-rendered from the enrollment, never from query params. */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>
}) {
  const { courseId } = await searchParams
  const confirmation = courseId ? await getCheckoutConfirmation(courseId) : null

  // No access-granting enrollment (bad link, unpaid reservation, refund) —
  // the course page holds the right next step.
  if (!confirmation) {
    redirect(courseId ? `/dashboard/courses/${courseId}` : "/dashboard/my-courses")
  }

  const startHref = confirmation.startLessonId
    ? `/dashboard/courses/${confirmation.courseId}/learn/${confirmation.startLessonId}`
    : `/dashboard/courses/${confirmation.courseId}`

  return (
    <>
      <Topbar title="Enrollment confirmed" />
      <div className="flex-1 px-4 pb-24 md:pb-8">
        <div className="mx-auto w-full max-w-md space-y-8 py-16">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ws-success/10">
              <CircleCheckIcon size={32} className="text-ws-success" aria-hidden />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary">
              Enrollment confirmed
            </h1>
            <p className="text-sm leading-relaxed text-ws-muted">
              Welcome to {BRAND.name}. Your learning journey starts now.
            </p>
            <div className="rounded-lg bg-ws-surface px-4 py-3 text-left">
              <p className="text-sm font-medium text-ws-primary">{confirmation.courseTitle}</p>
              {confirmation.packageName && (
                <p className="mt-0.5 text-xs text-ws-muted">{confirmation.packageName}</p>
              )}
            </div>
          </div>

          {confirmation.needsIntake && <MentorshipIntakeForm courseId={confirmation.courseId} />}
          {confirmation.intakeSent && (
            <p className="text-center text-xs text-ws-muted">
              Your mentor has your intake — they&apos;ll be in touch to schedule onboarding.
            </p>
          )}

          <div className="space-y-3">
            <Button className="h-11 w-full gap-2" size="lg" render={<Link href={startHref} />}>
              Start learning
              <ArrowRightIcon size={16} aria-hidden />
            </Button>
            <Button variant="outline" className="h-11 w-full" size="lg" render={<Link href="/dashboard?welcome=1" />}>
              Go to dashboard
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
