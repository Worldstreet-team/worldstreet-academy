import { cn } from "@/lib/utils"

/**
 * Compact stat tile for dashboards (instructor overview, analytics, admin):
 * label caption, big tabular value, optional context line and icon chip.
 * One shape everywhere — replaces the three hand-rolled Card+wash variants.
 */
export function StatTile({
  label,
  value,
  context,
  icon,
  tone = "neutral",
  className,
}: {
  label: string
  value: React.ReactNode
  /** Small line under the value — period, delta, breakdown. */
  context?: React.ReactNode
  icon?: React.ReactNode
  /** Colors the icon chip only; the value stays primary. */
  tone?: "neutral" | "gold" | "success" | "danger"
  className?: string
}) {
  const chipTone = {
    neutral: "bg-ws-raised text-ws-muted",
    gold: "bg-ws-raised text-ws-gold",
    success: "bg-ws-raised text-ws-success",
    danger: "bg-ws-raised text-ws-danger",
  }[tone]

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-ws-hairline bg-ws-surface p-4",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">
          {label}
        </p>
        <p className="mt-1 truncate font-display text-xl font-semibold tabular-nums text-ws-primary">
          {value}
        </p>
        {context && <p className="mt-0.5 text-[12px] text-ws-subtle">{context}</p>}
      </div>
      {icon && (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            chipTone
          )}
        >
          {icon}
        </div>
      )}
    </div>
  )
}
