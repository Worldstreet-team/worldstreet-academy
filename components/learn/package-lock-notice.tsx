import { LockIcon } from "@/components/icons"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * What a student sees where their package stops — a lesson, an assessment, a
 * live class, instructor Q&A. Packages can't be changed at checkout in v1 (D5):
 * support moves an enrollment to another package, so the only action is a
 * support link, never a purchase.
 *
 * 2026-11-12: a place can now move up a plan by paying the difference (Owen;
 * the program page's "Your plan"). With `upgradeHref` the notice points there
 * instead (no figure here, the program page quotes it); without it, support.
 */
export function PackageLockNotice({
  title,
  requiredLabel,
  compact = false,
  upgradeHref = null,
}: {
  title: string
  /** Tier that includes it ("Standard"), or null when no tier on sale does. */
  requiredLabel: string | null
  compact?: boolean
  /** The program page's "Your plan" section, when the learner's place can move up to a plan that opens this. */
  upgradeHref?: string | null
}) {
  if (upgradeHref) {
    return (
      <div className={cn("flex gap-3", compact ? "flex-wrap items-center" : "flex-col items-center gap-4 text-center")}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
          <LockIcon size={18} className="text-ws-muted" aria-hidden />
        </div>
        <div className={cn("space-y-1", compact && "min-w-0 flex-1")}>
          <p className="text-sm font-semibold text-ws-primary">{title}</p>
          <p className="text-xs leading-relaxed text-ws-muted">
            {requiredLabel ? `Included from the ${requiredLabel} plan.` : "Not included in your plan."} You can move up
            any time and pay only the difference.
          </p>
        </div>
        <Button size="sm" render={<Link href={upgradeHref} />}>
          See upgrade options
        </Button>
      </div>
    )
  }
  return (
    <div
      className={cn(
        "flex gap-3",
        compact ? "flex-wrap items-center" : "flex-col items-center gap-4 text-center"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ws-raised">
        <LockIcon size={18} className="text-ws-muted" aria-hidden />
      </div>
      <div className={cn("space-y-1", compact && "min-w-0 flex-1")}>
        <p className="text-sm font-semibold text-ws-primary">{title}</p>
        <p className="text-xs leading-relaxed text-ws-muted">
          {requiredLabel ? `Included from the ${requiredLabel} plan.` : "Not included in your plan."} To
          change your plan, contact support.
        </p>
      </div>
      <Button variant="outline" size="sm" render={<Link href="/dashboard/help" />}>
        Contact support
      </Button>
    </div>
  )
}
