import Link from "next/link"
import { LockIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * What a student sees where their package stops — a lesson, an assessment, a
 * live class, instructor Q&A. Packages can't be changed at checkout in v1 (D5):
 * support moves an enrollment to another package, so the only action is a
 * support link, never a purchase.
 */
export function PackageLockNotice({
  title,
  requiredLabel,
  compact = false,
}: {
  title: string
  /** Tier that includes it ("Standard"), or null when no tier on sale does. */
  requiredLabel: string | null
  compact?: boolean
}) {
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
          {requiredLabel ? `Included from the ${requiredLabel} package.` : "Not included in your package."} To
          change your package, contact support.
        </p>
      </div>
      <Button variant="outline" size="sm" render={<Link href="/dashboard/help" />}>
        Contact support
      </Button>
    </div>
  )
}
