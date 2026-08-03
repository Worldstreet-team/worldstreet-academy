import { cn } from "@/lib/utils"

/**
 * The standard page header used across all portals: Poppins display title,
 * muted subline, optional right-aligned action. Matches the restyled student
 * pages (dashboard, wallet, my-courses) so every surface leads with the same
 * typographic voice.
 */
export function PageHeader({
  title,
  subline,
  action,
  className,
}: {
  title: string
  subline?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "ws-animate-in flex flex-wrap items-end justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ws-primary">
          {title}
        </h1>
        {subline && <p className="mt-1 text-[15px] text-ws-muted">{subline}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
