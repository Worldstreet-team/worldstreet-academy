import { SectionLabel } from "@/components/marketing/section-heading"
import { cn } from "@/lib/utils"

/**
 * Spec §7 for the PUBLIC program page: the outcomes a visitor is deciding on.
 *
 * Deliberately not `components/courses/course-outcomes.tsx` — that one is the
 * signed-in course page's compact checklist and is shared with
 * `/dashboard/courses/[courseId]`. This is the marketing treatment. The two
 * are meant to diverge; don't merge them back together.
 *
 * Why this is a ruled index and not tiles (2026-09-16): it used to be a
 * `lg:grid-cols-3` of rounded cards, each with a gold circular check — which
 * is the same shape, radius and gold chip as `whats-included.tsx` directly
 * below it. Two tile grids back to back read as one long band of ~25
 * identical boxes, and gold on every chip is decoration, which the design
 * system reserves (gold = CTA, active state, brand). So:
 *
 *  · no cards — the outcomes are words, and the words carry the section;
 *  · no gold, no checkmarks — a check claims "done", and nothing is done
 *    yet; the visitor hasn't bought the program;
 *  · an asymmetric track (statement left, index right) so the section has a
 *    different silhouette from every tile grid around it;
 *  · one reveal on the whole list instead of fourteen staggered ones.
 *
 * `.ws-reveal` is CSS, scroll-driven, and defaults to VISIBLE — see the note
 * on that class in app/globals.css. Where it isn't defined the list is simply
 * static, which is why it sits on the container and nothing depends on it.
 *
 * Requirements and "who this is for" stay quiet bullet columns in the same
 * right-hand track, so the section reads as one composition. Most catalogue
 * programs carry neither, so each renders only when it has content.
 */
export function ProgramOutcomes({
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
    <section
      id="outcomes"
      className="mt-16 scroll-mt-24 border-t border-ws-hairline pt-10"
      aria-labelledby="outcomes-heading"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-14">
        {/* The statement. Without outcomes the promise heading would be a lie,
            so the pair below it names what the section actually holds. */}
        <div className="lg:pt-1">
          <SectionLabel>{hasLearn ? "What you'll learn" : "Good to know"}</SectionLabel>
          <h2
            id="outcomes-heading"
            className="mt-3 font-display text-2xl font-semibold tracking-[-0.015em] text-ws-primary"
          >
            {hasLearn ? "By the end of this program" : "Before you start"}
          </h2>
          {hasLearn && (
            <p className="mt-3 text-[13px] tabular-nums text-ws-muted">
              {whatYouWillLearn.length} {whatYouWillLearn.length === 1 ? "outcome" : "outcomes"}
            </p>
          )}
        </div>

        <div className="min-w-0">
          {hasLearn && (
            /* Two tracks from `sm`, flowing row-wise: odd children land in the
               left track, even in the right, which is what the spine below
               keys off. The last row's rule closes the list, so the block
               after it needs no border of its own. */
            <ul
              className={cn(
                "ws-reveal grid border-t border-ws-hairline",
                // A lone outcome in a two-track grid would rule half the width.
                whatYouWillLearn.length > 1 && "sm:grid-cols-2"
              )}
            >
              {whatYouWillLearn.map((item) => (
                <li
                  key={item}
                  className={cn(
                    "border-b border-ws-hairline py-3.5 text-[15px] leading-snug text-ws-primary",
                    "sm:[&:nth-child(odd)]:pr-6",
                    "sm:[&:nth-child(even)]:border-l sm:[&:nth-child(even)]:border-ws-hairline sm:[&:nth-child(even)]:pl-6"
                  )}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}

          {(hasRequirements || hasAudience) && (
            <div className={cn("grid gap-8 sm:grid-cols-2", hasLearn && "mt-9")}>
              {hasRequirements && (
                <div>
                  <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-ws-primary">
                    What you need to start
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {requirements.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ws-subtle" />
                        <span className="text-sm leading-relaxed text-ws-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {hasAudience && (
                <div>
                  <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-ws-primary">
                    Who this program is for
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {targetAudience.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ws-subtle" />
                        <span className="text-sm leading-relaxed text-ws-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
