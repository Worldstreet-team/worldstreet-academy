/**
 * Timing rules for scheduled course classes and mentorship sessions, shared by
 * `joinMeeting` (which enforces them) and the tutor calendar (which only
 * decides what to offer). Pure — safe in client components.
 */

/** How early the host may start a scheduled course class or mentorship session (joinMeeting refuses before that). */
export const HOST_EARLY_START_MS = 15 * 60_000

/** True once the host may start a room scheduled for `scheduledAt`. */
export function hostMayStart(scheduledAt: Date | string, now: number = Date.now()): boolean {
  return new Date(scheduledAt).getTime() - now <= HOST_EARLY_START_MS
}
