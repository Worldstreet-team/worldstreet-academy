"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { preEnrollCourse } from "@/lib/actions/enrollments"
import { AvailabilityCountdown } from "@/components/shared/availability-countdown"
import { CalendarClockIcon, CheckIcon } from "lucide-react"

function formatLaunch(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * The pre-live face of a course page: countdown, launch date, and the right
 * action for where this customer stands. Rendered by both course detail
 * pages whenever the course is not plain-live-and-active:
 *
 *  coming soon + not enrolled  → free pre-enroll button (or plain countdown
 *                                when pre-enrollment is off)
 *  coming soon + pre-enrolled  → "Enrolled" state + countdown
 *  live + pre-enrolled         → "Start course — pay …" into checkout, which
 *                                activates the reservation
 */
export function CourseSchedulingCta({
  courseId,
  availableAt,
  isComingSoon,
  preEnrollEnabled,
  isPreEnrolled,
  isPaid,
  price,
  signedIn,
}: {
  courseId: string
  availableAt: string | null
  isComingSoon: boolean
  preEnrollEnabled: boolean
  isPreEnrolled: boolean
  isPaid: boolean
  price: number | null
  signedIn: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function handlePreEnroll() {
    setError(null)
    startTransition(async () => {
      const res = await preEnrollCourse(courseId)
      if (!res.success) {
        // The course may have gone live under us — refresh resolves both cases.
        if (res.code === "already_live") router.refresh()
        else setError(res.error)
        return
      }
      router.refresh()
    })
  }

  // Live again, with a reservation: the countdown's job is done — send them
  // through checkout, which activates (and charges, if paid).
  if (!isComingSoon && isPreEnrolled) {
    return (
      <div className="flex w-full flex-col gap-2">
        <Link
          href={`/dashboard/checkout?courseId=${courseId}`}
          className="flex h-11 flex-1 items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
        >
          Start Course{isPaid && price ? ` — Pay $${price}` : ""}
        </Link>
        <p className="text-center text-[11px] text-ws-muted">
          Your seat is reserved{isPaid ? " — payment completes your access." : "."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-md border border-ws-hairline bg-ws-surface p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ws-gold">
          <CalendarClockIcon size={13} />
          {isPreEnrolled ? "Not live yet" : "Coming soon"}
        </p>
        {availableAt && (
          <>
            <p className="mt-1 text-xs text-ws-muted">
              Available on <span className="font-medium text-ws-primary">{formatLaunch(availableAt)}</span>
            </p>
            <AvailabilityCountdown availableAt={availableAt} className="mt-2" />
          </>
        )}
      </div>

      {isPreEnrolled ? (
        <div className="flex h-11 items-center justify-center gap-1.5 rounded-sm bg-ws-chip text-sm font-semibold text-ws-primary">
          <CheckIcon size={15} className="text-ws-success" />
          Enrolled
        </div>
      ) : preEnrollEnabled ? (
        signedIn ? (
          <button
            type="button"
            onClick={handlePreEnroll}
            disabled={pending}
            className="flex h-11 cursor-pointer items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Enrolling…" : "Enroll Now — Free Until Launch"}
          </button>
        ) : (
          <Link
            href="/login"
            className="flex h-11 items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity hover:opacity-90"
          >
            Sign in to enroll
          </Link>
        )
      ) : (
        <div className="flex h-11 items-center justify-center rounded-sm bg-ws-chip text-sm font-medium text-ws-muted">
          Enrollment opens at launch
        </div>
      )}

      {isPreEnrolled && isPaid && price ? (
        <p className="text-center text-[11px] text-ws-muted">
          No payment yet — you&apos;ll be asked for ${price} when the course goes live.
        </p>
      ) : null}
      {error && <p className="text-center text-xs text-ws-danger">{error}</p>}
    </div>
  )
}
