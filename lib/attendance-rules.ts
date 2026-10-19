/**
 * Attendance rules (Institutional blueprint §12, decision D24). Pure and
 * client-safe: it imports nothing at runtime. MeetingProvider imports the ping
 * interval from here. D24 defines "attended" as at least 50% of the class or
 * at least 30 minutes. The 10-minute held floor is a named constant the owner
 * can tune.
 */

/** How often the client pings while a learner is in a class. */
export const ATTENDANCE_PING_MS = 60_000
/** A gap longer than this since the last bank is silence and earns nothing. */
export const ATTENDANCE_STALE_MS = 150_000
/** A class that ran for less than this was never held (an accidental start-and-stop). */
export const MIN_HELD_CLASS_SECONDS = 600
/** Attended means at least this share of the class... */
export const ATTENDED_FRACTION = 0.5
/** ...or this many seconds, whichever is less. */
export const ATTENDED_ENOUGH_SECONDS = 1800

/** A course class: `courseId` set and not a mentorship session. */
export function isCourseClass(meeting: { courseId?: unknown; mentorshipSessionId?: unknown }): boolean {
  return Boolean(meeting.courseId) && !meeting.mentorshipSessionId
}

/** Whole seconds from `openSince` to `at`; 0 for a negative, NaN or stale gap. */
export function bankSeconds(openSince: Date, at: Date): number {
  const gap = at.getTime() - openSince.getTime()
  if (!Number.isFinite(gap) || gap < 0 || gap > ATTENDANCE_STALE_MS) return 0
  return Math.floor(gap / 1000)
}

/** Banked seconds plus whatever the open interval would bank at `at`. */
export function attendedSeconds(row: { seconds: number; openSince: Date | null }, at: Date): number {
  return row.seconds + (row.openSince ? bankSeconds(row.openSince, at) : 0)
}

/** A class counts as held once it ran at least MIN_HELD_CLASS_SECONDS. */
export function classHeld(classSeconds: number): boolean {
  return classSeconds >= MIN_HELD_CLASS_SECONDS
}

/** A learner attended a class with ≥ 50% of it or ≥ 30 minutes, whichever is less. */
export function classAttended(attended: number, classSeconds: number): boolean {
  return attended > 0 && attended >= Math.min(classSeconds * ATTENDED_FRACTION, ATTENDED_ENOUGH_SECONDS)
}

/** Attended share of held classes, 0–100; null while nothing has been held. */
export function attendancePercent(attended: number, held: number): number | null {
  if (!(held > 0)) return null
  return (Math.min(attended, held) / held) * 100
}
