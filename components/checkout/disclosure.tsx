"use client"

import * as React from "react"
import { ChevronDownIcon, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/components/marketing/motion/bus"

const DESKTOP = "(min-width: 1024px)"

/**
 * One expandable row of checkout's order details. The panel unfolds on a
 * grid-rows transition (0fr → 1fr, so it opens to its real height with no
 * measuring) while the content inside settles down a few pixels as it fades
 * in; the chevron turns with it. Rise easing, 380ms. Reduced motion: instant.
 *
 * `defaultOpen="desktop"` starts the row open beside the payment card and
 * closed on a phone, where the rows sit under the payment card and a long
 * list would bury the page. Until the first click that default is pure CSS
 * (`lg:`), so the server render is already right on both and nothing jumps
 * at hydration; the click then hands the row to state. (CSS rather than a JS
 * height tween for exactly this reason: a tween needs a starting state the
 * server can't know.)
 *
 * Collapsed content is `inert`, so links inside a closed row are neither
 * focusable nor announced.
 */
export function Disclosure({
  icon: Icon,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  icon: LucideIcon
  title: string
  /** One quiet line under the title — what the row holds. */
  summary?: string
  defaultOpen?: boolean | "desktop"
  children: React.ReactNode
}) {
  const desktop = useMediaQuery(DESKTOP)
  // null = still on the responsive default (CSS decides what shows).
  const [chosen, setChosen] = React.useState<boolean | null>(defaultOpen === "desktop" ? null : defaultOpen)
  const open = chosen ?? desktop
  const responsive = chosen === null
  const id = React.useId()
  const buttonId = `${id}-button`
  const panelId = `${id}-panel`

  // One state, three looks: responsive (CSS picks by breakpoint), open, closed.
  const pick = (whenOpen: string, whenClosed: string, whenResponsive: string) =>
    responsive ? whenResponsive : open ? whenOpen : whenClosed

  return (
    <div className="border-t border-ws-hairline first:border-t-0">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setChosen((v) => !(v ?? window.matchMedia(DESKTOP).matches))}
          className="group flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ws-brand/40 sm:px-6"
        >
          <span
            aria-hidden
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-[var(--ws-motion-base)]",
              pick(
                "bg-ws-brand/[0.12] text-ws-gold",
                "bg-ws-raised text-ws-muted group-hover:text-ws-primary",
                "bg-ws-raised text-ws-muted group-hover:text-ws-primary lg:bg-ws-brand/[0.12] lg:text-ws-gold"
              )
            )}
          >
            <Icon size={17} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold leading-snug text-ws-primary">{title}</span>
            {summary && <span className="mt-0.5 truncate text-[13px] text-ws-muted">{summary}</span>}
          </span>
          <ChevronDownIcon
            size={18}
            aria-hidden
            className={cn(
              "shrink-0 text-ws-muted transition-transform duration-[var(--ws-motion-slow)] ease-[var(--ws-ease)] motion-reduce:transition-none",
              pick("rotate-180 text-ws-primary", "", "lg:rotate-180 lg:text-ws-primary")
            )}
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[380ms] ease-[var(--ws-ease-rise)] motion-reduce:transition-none",
          pick("grid-rows-[1fr] opacity-100", "grid-rows-[0fr] opacity-0", "grid-rows-[0fr] opacity-0 lg:grid-rows-[1fr] lg:opacity-100")
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "transition-transform duration-[420ms] ease-[var(--ws-ease-rise)] motion-reduce:transition-none",
              pick("translate-y-0", "-translate-y-2", "-translate-y-2 lg:translate-y-0"),
              // From sm the body hangs off the title's left edge (24px pad +
              // 36px chip + 14px gap); a phone keeps the full width.
              "px-5 pb-5 sm:px-6 sm:pb-6 sm:pl-[4.625rem]"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
