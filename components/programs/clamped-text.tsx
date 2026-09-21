"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Long prose, clamped to `lines` with a Show more / Show less toggle. The
 * toggle appears only when the clamp actually cuts something — measured, not
 * guessed from a character count — so a short bio never grows a dead button.
 * The fade under the last line is a mask (opacity), not a blur.
 */
export function ClampedText({
  text,
  lines = 6,
  className,
}: {
  text: string
  lines?: number
  className?: string
}) {
  const ref = React.useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [overflows, setOverflows] = React.useState(false)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [expanded, text])

  const clamped = !expanded
  return (
    <div>
      <p
        ref={ref}
        className={cn("whitespace-pre-line", className)}
        style={
          clamped
            ? {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lines,
                overflow: "hidden",
                ...(overflows
                  ? {
                      maskImage: "linear-gradient(to bottom, black calc(100% - 3em), transparent)",
                      WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 3em), transparent)",
                    }
                  : {}),
              }
            : undefined
        }
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-[14px] font-semibold text-ws-primary underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDownIcon
            size={15}
            aria-hidden
            className={cn("transition-transform duration-[var(--ws-motion-base)] motion-reduce:transition-none", expanded && "rotate-180")}
          />
        </button>
      )}
    </div>
  )
}
