import { cn } from "@/lib/utils"
import { PROGRAM_H2 } from "@/components/programs/section-title"

/**
 * Spec §7 for the PUBLIC program page: the outcomes a visitor is deciding on.
 *
 * Deliberately not `components/courses/course-outcomes.tsx` — that one is the
 * signed-in course page's compact checklist and is shared with
 * `/dashboard/courses/[courseId]`. This is the marketing treatment. The two
 * are meant to diverge; don't merge them back together.
 *
 * One surface card, two columns of plain statements. The markers are small
 * open rings in muted ink — not checkmarks (a check claims "done", and
 * nothing is done before the visitor buys) and not gold (gold is CTA, active
 * state and brand). No scroll-driven reveal: this is the content a visitor
 * decides on, so it is simply there.
 */
export function ProgramOutcomes({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <section
      aria-labelledby="learn-heading"
      className="rounded-[20px] border border-ws-hairline bg-ws-surface p-6 dark:border-transparent sm:p-8"
    >
      <h2 id="learn-heading" className={PROGRAM_H2}>
        What you&apos;ll learn
      </h2>
      <ul className={cn("mt-6 grid gap-x-10 gap-y-4", items.length > 1 && "sm:grid-cols-2")}>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3.5 text-[15px] leading-relaxed text-ws-primary">
            <span aria-hidden className="mt-[0.55em] size-2 shrink-0 rounded-full ring-[1.5px] ring-ws-muted" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * "What you need to start" and "Who this program is for" — two quiet
 * columns, each only when it has items. Most catalogue programs carry
 * neither, and then nothing renders.
 */
export function ProgramPrerequisites({
  requirements,
  targetAudience,
}: {
  requirements: string[]
  targetAudience: string[]
}) {
  const columns = [
    { id: "requirements", title: "What you need to start", items: requirements },
    { id: "audience", title: "Who this program is for", items: targetAudience },
  ].filter((column) => column.items.length > 0)
  if (columns.length === 0) return null

  return (
    <div className={cn("grid gap-10", columns.length > 1 && "sm:grid-cols-2")}>
      {columns.map((column) => (
        <section key={column.id} aria-labelledby={`${column.id}-heading`}>
          <h2 id={`${column.id}-heading`} className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ws-primary">
            {column.title}
          </h2>
          <ul className="mt-4 space-y-3">
            {column.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-ws-muted">
                <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-ws-subtle" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
