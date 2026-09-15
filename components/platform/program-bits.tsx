import type * as React from "react"
import Image from "next/image"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "@/lib/utils"

/*
 * Program visuals shared by the student home and the course card — the cover,
 * the 4px progress track and the two chip kinds — so a program looks the same
 * wherever it appears (design-system 05: "course cards with 4px gold progress
 * tracks on surface-sunken").
 */

const MARK_WIDTH = { sm: 16, md: 36, lg: 60 } as const

/**
 * A program's cover: the course photograph, or — while a course has none — the
 * gold WorldStreet mark on the sunken step under the system's ambient glow, so
 * a missing thumbnail reads as a deliberate cover rather than a grey hole.
 * Size and corners come from the caller.
 */
export function ProgramCover({
  src,
  sizes,
  mark = "md",
  className,
}: {
  src: string | null | undefined
  /** next/image `sizes` for the photograph. */
  sizes: string
  /** Mark size on the fallback: sm for row thumbnails, md for cards, lg for the hero. */
  mark?: keyof typeof MARK_WIDTH
  className?: string
}) {
  return (
    <div className={cn("relative overflow-hidden bg-accent dark:bg-surface-sunken", className)}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundImage: "radial-gradient(circle at 50% 50%, var(--color-ws-glow), transparent 72%)" }}
        >
          <Image
            src="/brand/wsa-mark.png"
            alt=""
            width={206}
            height={118}
            className="h-auto"
            style={{ width: MARK_WIDTH[mark] }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * The 4px gold progress track. The track is the sunken step in dark; on paper
 * the sunken step is too close to white to read, so it takes a faint ink wash.
 * Zero draws no sliver — an empty track is not a measurement.
 */
export function ProgressTrack({
  value,
  label,
  className,
}: {
  /** 0–100. */
  value: number
  /** Accessible name, e.g. "Forex Mastery progress". */
  label: string
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-foreground/[0.08] dark:bg-surface-sunken", className)}
    >
      {pct > 0 && <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 3)}%` }} />}
    </div>
  )
}

/** The package bought ("Executive"). Callers render it only for `explicitPackage` rows. */
export function PackageChip({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full shrink-0 truncate rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-semibold text-foreground",
        className
      )}
    >
      {name}
    </span>
  )
}

const TONE = {
  neutral: "bg-foreground/[0.06] text-muted-foreground",
  success: "bg-credit-chip text-credit",
  warning: "bg-warning-chip text-warning",
  danger: "bg-debit-chip text-debit",
} as const

/** A state chip — a wash with full-strength text (design-system 01, "chips are washes"). */
export function StatusChip({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: keyof typeof TONE
  icon?: IconSvgElement
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "ws-icon-mono inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        TONE[tone],
        className
      )}
    >
      {icon && <HugeiconsIcon icon={icon} className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  )
}
