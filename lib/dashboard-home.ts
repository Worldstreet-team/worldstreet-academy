import type { StudentEnrollment } from "@/lib/actions/student"
import type { IPackageEntitlements } from "@/lib/db/models"

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

/**
 * Newest first by `lastAccessedAt` — the ordering the sidebar's "Continue
 * learning" row uses. Never-opened rows serialize as "now", so a fresh purchase leads.
 */
function byRecentAccess(a: StudentEnrollment, b: StudentEnrollment): number {
  return new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
}

/** Continue learning → the most recently accessed active or completed enrollment. */
export function pickResume(enrollments: StudentEnrollment[]): StudentEnrollment | null {
  return [...enrollments].filter(grantsAccess).sort(byRecentAccess)[0] ?? null
}

/** Current course → the most recently accessed active enrollment. */
export function pickCurrent(enrollments: StudentEnrollment[]): StudentEnrollment | null {
  return [...enrollments].filter((e) => e.status === "active").sort(byRecentAccess)[0] ?? null
}

/** "Priority support" — only a package actually bought with it, on an enrollment that still grants access. */
export function hasPrioritySupport(enrollments: StudentEnrollment[]): boolean {
  return enrollments.some((e) => grantsAccess(e) && e.explicitPackage && e.entitlements.prioritySupport)
}

/** "Your mentor" — an Executive package with mentorship. Single "Full program" tiers also carry mentorship and never qualify. */
export function isMentorEnrollment(enrollment: StudentEnrollment): boolean {
  return (
    grantsAccess(enrollment) &&
    enrollment.explicitPackage &&
    enrollment.packageKey === "executive" &&
    enrollment.entitlements.mentorship
  )
}

export type InstructorRow = {
  instructorId: string
  name: string
  avatarUrl: string | null
  headline: string | null
  /** Some access-granting enrollment with this instructor includes Q&A — the getOrCreateConversation gate. */
  canMessage: boolean
  isMentor: boolean
}

/** One row per distinct instructor across the student's access-granting enrollments. */
export function instructorRows(enrollments: StudentEnrollment[]): InstructorRow[] {
  const rows = new Map<string, InstructorRow>()
  for (const e of enrollments) {
    if (!grantsAccess(e)) continue
    const row = rows.get(e.instructorId) ?? {
      instructorId: e.instructorId,
      name: e.instructorName,
      avatarUrl: e.instructorAvatarUrl,
      headline: e.instructorHeadline,
      canMessage: false,
      isMentor: false,
    }
    row.canMessage = row.canMessage || e.entitlements.instructorQa
    row.isMentor = row.isMentor || isMentorEnrollment(e)
    rows.set(e.instructorId, row)
  }
  return [...rows.values()]
}

/** Whether any access-granting enrollment's package includes `flag` — tiles that can't be backed stay hidden. */
export function includesAny(enrollments: StudentEnrollment[], flag: keyof IPackageEntitlements): boolean {
  return enrollments.some((e) => grantsAccess(e) && e.entitlements[flag])
}

/** The codebase's date + time format. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
}
