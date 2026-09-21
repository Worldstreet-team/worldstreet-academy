import { CompassIcon } from "lucide-react"

/**
 * Why a signed-in learner is looking at the schools: the school-first gate
 * sent them (`/schools?start=1`, `schoolsPathFor`). The page renders it only
 * for a learner the gate would still send — no enrollment, no saved program —
 * so it always tells the truth about what opens the dashboard.
 */
export function GateNotice({ firstName }: { firstName: string }) {
  return (
    <div
      role="status"
      className="rise mb-10 flex items-start gap-4 rounded-[20px] border border-ws-hairline bg-ws-surface p-4 dark:border-transparent md:mb-14 md:items-center md:p-5 md:pr-7"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-ws-chip text-ws-primary">
        <CompassIcon size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[16px] font-semibold leading-snug text-ws-primary">
          {firstName ? `Welcome, ${firstName}. ` : null}Choose a program to get started
        </p>
        <p className="mt-1 text-pretty text-[14px] leading-relaxed text-ws-muted">
          Your dashboard opens once you enrol, or save a program to pay later.
        </p>
      </div>
    </div>
  )
}
