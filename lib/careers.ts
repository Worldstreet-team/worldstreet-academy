/**
 * Staff tutor hiring (Owen, voice note 2026-11-05). The Academy employs a few
 * tutors for its official students, the way any employer hires: a vacancy on
 * `/careers`, a job application, an interview at the office or online, then an
 * approve-or-reject decision. That is a different door from the marketplace,
 * where anyone may sign up to sell their own courses (`/sell`,
 * lib/marketplace.ts) and is approved on their details without ever teaching
 * the Academy's students.
 *
 * Pure and client-safe: the careers page, the application page, the admin
 * review screen and the server actions all read these.
 */

/**
 * Whether the Academy is hiring staff tutors right now. While false, `/careers`
 * says there are no openings and no new staff application can be submitted;
 * applications already in the pipeline keep moving and stay reviewable.
 * Flip to true (and redeploy) when a vacancy goes out.
 */
export const HIRING_OPEN = true

/** Where the staff tutor job application lives (signed in; a guest signs in on the hub first). */
export const STAFF_APPLY_HREF = "/dashboard/become-instructor"

/** How a staff tutor interview is held. */
export const INTERVIEW_MODES = ["office", "online"] as const
export type InterviewMode = (typeof INTERVIEW_MODES)[number]

/** What the applicant can manage; "either" leaves it to the reviewer. */
export const INTERVIEW_PREFERENCES = ["office", "online", "either"] as const
export type InterviewPreference = (typeof INTERVIEW_PREFERENCES)[number]

export const INTERVIEW_MODE_LABEL: Record<InterviewMode, string> = {
  office: "At the office",
  online: "Online video call",
}

export const INTERVIEW_PREFERENCE_LABEL: Record<InterviewPreference, string> = {
  office: "At the office, in person",
  online: "Online, by video call",
  either: "Either works for me",
}

export function isInterviewMode(value: unknown): value is InterviewMode {
  return typeof value === "string" && (INTERVIEW_MODES as readonly string[]).includes(value)
}

/** The reviewer's starting choice of mode for an applicant's stated preference. */
export function defaultInterviewMode(preference: InterviewPreference | undefined): InterviewMode {
  return preference === "office" ? "office" : "online"
}

/** Longest office address or directions a reviewer may write. */
export const INTERVIEW_LOCATION_MAX = 300
