import { cn } from "@/lib/utils"

/**
 * A sequence of stops (Wealth Liquefaction, the core transformation, the
 * journey examples). Static server markup: two columns on phones, one wrapping
 * line with hairline connectors from `sm`. A connector trails its stop, so a wrapped row never starts with one. The last stop is the outcome and the
 * only word that takes gold.
 */
export function Chain({
  steps,
  label,
  className,
}: {
  steps: readonly string[]
  label: string
  className?: string
}) {
  return (
    <ol
      aria-label={label}
      className={cn("grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-0", className)}
    >
      {steps.map((step, i) => {
        const last = i === steps.length - 1
        return (
          <li key={step} className="flex items-center">
            <span className="flex items-center gap-2.5">
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", last ? "bg-ws-brand" : "bg-ws-subtle")} />
              <span
                className={cn(
                  "font-display text-[15px] font-semibold tracking-[-0.01em] md:text-[16px]",
                  last ? "text-ws-gold" : "text-ws-primary"
                )}
              >
                {step}
              </span>
            </span>
            {!last && <span aria-hidden className="mx-4 hidden h-px w-8 bg-ws-hairline sm:block md:w-12" />}
          </li>
        )
      })}
    </ol>
  )
}
