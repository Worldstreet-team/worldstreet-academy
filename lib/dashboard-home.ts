import type { StudentEnrollment } from "@/lib/actions/student"

/*
 * Pure selectors over the student's enrollments (`fetchMyEnrollments`). The
 * dashboard, My programs and the help page share them, and every "is this
 * true for this student?" decision lives here so it can be asserted without a
 * browser. No React, no server imports — `import type` only.
 */

/** The statuses that open the player — the same two `lib/course-access.ts` counts. */
export function grantsAccess(enrollment: Pick<StudentEnrollment, "status">): boolean {
  return enrollment.status === "active" || enrollment.status === "completed"
}

/** Access-granting rows open the player where the student left off; every other row opens the course page. */
export function enrollmentHref(enrollment: StudentEnrollment): string {
  return grantsAccess(enrollment)
    ? `/dashboard/courses/${enrollment.courseId}/learn/${enrollment.resumeLessonId ?? enrollment.firstLessonId ?? "first"}`
    : `/dashboard/courses/${enrollment.courseId}`
}

/** A reservation on a course whose launch is still ahead — the card's "Not live yet" face. */
export function isComingSoon(enrollment: StudentEnrollment, now: number): boolean {
  return (
    enrollment.status === "pre_enrolled" &&
    !!enrollment.courseAvailableAt &&
    new Date(enrollment.courseAvailableAt).getTime() > now
  )
}

const STATUS_CHIP: Record<string, string> = {
  pre_enrolled: "Seat reserved",
  expired: "Access expired",
  refunded: "Refunded",
  suspended: "Suspended",
  cancelled: "Cancelled",
}

/**
 * Cover chip for rows that don't open the player. `active` needs none,
 * `completed` already shows the card's own Completed chip (completed rows carry
 * progress 100), and a reservation before launch shows "Not live yet" instead.
 */
export function enrollmentStatusLabel(enrollment: StudentEnrollment, now: number): string | null {
  if (grantsAccess(enrollment) || isComingSoon(enrollment, now)) return null
  return STATUS_CHIP[enrollment.status] ?? null
}
