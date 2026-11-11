import { CompassIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * Why a signed-in learner is looking at the schools: the gate sent them
 * (`?start=1`, `schoolsPathFor`) to `/schools` or a school's page. The page
 * renders it only for a learner the gate would still send (`gateWelcome`) — no
 * paid enrollment (owner meeting 2026-10-03) — so it always tells the truth
 * about what opens the dashboard. It names the WorldStreet account they are
 * signed in with and the wallet they will pay from, so the account, the
 * program and the payment read as one path (2026-11-11).
 */
export function GateNotice({ firstName, className }: { firstName: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "rise mb-10 flex items-start gap-4 rounded-[20px] border border-ws-hairline bg-ws-surface p-4 dark:border-transparent md:mb-14 md:items-center md:p-5 md:pr-7",
        className
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-ws-chip text-ws-primary">
        <CompassIcon size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[16px] font-semibold leading-snug text-ws-primary">
          {firstName ? `Welcome, ${firstName}. ` : null}Next, choose your program
        </p>
        <p className="mt-1 text-pretty text-[14px] leading-relaxed text-ws-muted">
          You&apos;re signed in with your WorldStreet account. Choose a program and a plan, then pay from your
          WorldStreet wallet. Your dashboard opens once you&apos;re enrolled.
        </p>
      </div>
    </div>
  )
}
