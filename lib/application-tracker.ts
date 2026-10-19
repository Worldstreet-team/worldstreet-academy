/**
 * The applicant's pipeline tracker — institutional blueprint §16, D29.
 *
 * Application → Academic review → Interview → Teaching demonstration (only when
 * a reviewer requested one) → Decision. Pure, no imports: both the applicant
 * page and any future surface read the same steps.
 */

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
