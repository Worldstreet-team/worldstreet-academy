import { CheckIcon } from "lucide-react"

/**
 * Sales-layer sections shared by both course detail pages: "What you'll
 * learn" (2-col checklist), "Requirements" and "Who this course is for"
 * (compact bullets). Each section renders only when it has content.
 */
export function CourseOutcomes({
  whatYouWillLearn,
  requirements,
  targetAudience,
}: {
  whatYouWillLearn: string[]
  requirements: string[]
  targetAudience: string[]
}) {
  const hasLearn = whatYouWillLearn.length > 0
  const hasRequirements = requirements.length > 0
  const hasAudience = targetAudience.length > 0

  if (!hasLearn && !hasRequirements && !hasAudience) return null

  return (
    <div className="space-y-6">
      {hasLearn && (
        <section className="rounded-lg border border-ws-hairline bg-ws-surface p-5 md:p-6">
          <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ws-primary">
            What you&apos;ll learn
          </h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {whatYouWillLearn.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckIcon
                  
                  size={15}
                  className="mt-0.5 shrink-0 text-ws-gold" />
                <span className="text-sm leading-relaxed text-ws-muted">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(hasRequirements || hasAudience) && (
        <div className="grid gap-6 md:grid-cols-2">
          {hasRequirements && (
            <section>
              <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-ws-primary">
                Requirements
              </h2>
              <ul className="mt-2.5 space-y-1.5">
                {requirements.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ws-subtle"
                    />
                    <span className="text-sm leading-relaxed text-ws-muted">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {hasAudience && (
            <section>
              <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-ws-primary">
                Who this course is for
              </h2>
              <ul className="mt-2.5 space-y-1.5">
                {targetAudience.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ws-subtle"
                    />
                    <span className="text-sm leading-relaxed text-ws-muted">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
