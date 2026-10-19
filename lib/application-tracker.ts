/**
 * The applicant's pipeline tracker — institutional blueprint §16, D29.
 *
 * Application → Academic review → Interview → Teaching demonstration (only when
 * a reviewer requested one) → Decision. Pure, no imports: both the applicant
 * page and any future surface read the same steps.
 */

/** From application to a faculty dashboard — institutional blueprint §16. */
export const APPLICATION_STEPS = [
  { title: "Application", body: "Tell us what you'd like to teach and why, and upload your CV. It takes about ten minutes." },
  { title: "Academic review", body: "Our team reads every application. You'll hear back by email and in the app." },
  {
    title: "Interview",
    body: "We schedule a short call on the platform — usually a few times for you to pick from — and you join it from your dashboard.",
  },
  {
    title: "Teaching demonstration",
    body: "Where appropriate, the reviewer asks you to give a teaching demonstration on the platform. You join it from your dashboard, like the interview.",
  },
  { title: "Approval", body: "We decide after the interview, and the demonstration if there was one, and tell you by email and in the app." },
  {
    title: "Onboarding",
    body: "Accept the instructor agreement, complete your profile and signature, verify your identity for payouts, and read the teaching standards, curriculum guidelines and platform training. Then you receive your WMA Faculty credential.",
  },
] as const

export type TrackerStep = {
  key: "submitted" | "under_review" | "interview" | "demo" | "decision"
  label: string
}

export function trackerFor(
  status: string,
  demoRequested: boolean
): { steps: TrackerStep[]; current: number } {
  const steps: TrackerStep[] = [
    { key: "submitted", label: "Submitted" },
    { key: "under_review", label: "Under review" },
    { key: "interview", label: "Interview" },
    ...(demoRequested ? [{ key: "demo", label: "Teaching demonstration" } as const] : []),
    { key: "decision", label: "Decision" },
  ]
  const last = steps.length - 1
  switch (status) {
    case "submitted":
      return { steps, current: 0 }
    case "under_review":
      return { steps, current: 1 }
    case "interview_scheduled":
      return { steps, current: demoRequested ? 3 : 2 }
    case "approved":
    case "rejected":
      return { steps, current: last }
    default:
      return { steps, current: 0 }
  }
}
