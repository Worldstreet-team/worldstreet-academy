import { CheckIcon } from "@/components/icons"
import { shortDate } from "@/lib/faculty-format"
import type { StudentPerformance } from "@/lib/actions/faculty-students"

/**
 * The classes held since a learner enrolled. With `attended` (the ids of
 * classes they were in) an "Attended" column appears; that is the Phase 16
 * follow-up, so for now callers pass nothing.
 */
export function ClassesList({
  classes,
  attended,
}: {
  classes: StudentPerformance["classes"]
  attended?: ReadonlySet<string>
}) {
  if (classes.length === 0) {
    return <p className="px-4 pb-4 text-[13px] text-muted-foreground">No classes held since this learner enrolled</p>
  }
  return (
    <ul className="divide-y divide-border">
      {classes.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
          <span className="min-w-0 truncate font-medium">{c.title}</span>
          <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
            {attended && (
              <span className="inline-flex items-center gap-1">
                {attended.has(c.id) ? (
                  <>
                    <CheckIcon size={14} aria-hidden className="text-ws-success" />
                    Attended
                  </>
                ) : (
                  "Absent"
                )}
              </span>
            )}
            <span className="tabular-nums">{shortDate(c.heldAt)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
