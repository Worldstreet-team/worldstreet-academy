"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { CardShell, Eyebrow } from "@/components/ui/system"
import { cn } from "@/lib/utils"

type Copied = "link" | "code" | null

/**
 * The caller's code and link, each one tap to copy. The link is the primary
 * action on the page, so it carries the gold; the code copies from a bare
 * icon beside it.
 */
export function ReferralShare({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = React.useState<Copied>(null)
  const [failed, setFailed] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function copy(what: Exclude<Copied, null>, value: string) {
    setFailed(false)
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(what)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(null), 1800)
      },
      () => setFailed(true)
    )
  }

  return (
    <CardShell className="p-5">
      <Eyebrow>Your code</Eyebrow>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="font-display text-[26px] font-semibold tracking-[0.04em] tabular-nums">{code}</span>
        <button
          type="button"
          onClick={() => copy("code", code)}
          aria-label="Copy your code"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <HugeiconsIcon icon={copied === "code" ? Tick02Icon : Copy01Icon} className="size-[18px]" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <span
          className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-surface-sunken px-4 text-[13.5px] text-muted-foreground"
          title={link}
        >
          <span className="truncate">{link}</span>
        </span>
        <button
          type="button"
          onClick={() => copy("link", link)}
          // Mono: the icon's gold inner strokes would vanish on the gold fill.
          className="ws-icon-mono inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors duration-[var(--ws-motion-fast)] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <HugeiconsIcon icon={copied === "link" ? Tick02Icon : Copy01Icon} className="size-4" />
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>

      <p
        role="status"
        className={cn("mt-3 text-[12.5px] leading-relaxed", failed ? "text-debit" : "text-muted-foreground")}
      >
        {failed
          ? "Couldn't copy — select the link and copy it yourself."
          : copied === "code"
            ? "Code copied."
            : "Share it anywhere. Anyone who opens it and joins within 30 days is linked to you."}
      </p>
    </CardShell>
  )
}
