import type { CSSProperties } from "react"

/**
 * Course difficulty reads as a traffic ramp — beginner green, intermediate
 * gold, advanced red — rendered as ~13% accent washes with theme-corrected
 * text tokens so the chips stand apart without shouting. Unknown levels fall
 * back to the neutral chip treatment.
 */
export function levelChipStyle(level: string): CSSProperties {
  const l = level.toLowerCase()
  if (l.startsWith("beg"))
    return { backgroundColor: "color-mix(in srgb, var(--ws-status-success) 13%, transparent)", color: "var(--ws-status-success)" }
  if (l.startsWith("int"))
    return { backgroundColor: "color-mix(in srgb, var(--ws-brand-primary) 13%, transparent)", color: "var(--ws-brand-gold-text)" }
  if (l.startsWith("adv"))
    return { backgroundColor: "color-mix(in srgb, var(--ws-status-danger) 13%, transparent)", color: "var(--ws-status-danger)" }
  return { backgroundColor: "var(--ws-bg-chip)", color: "var(--ws-text-muted)" }
}

/**
 * Text-only variant for badges that sit on glass/scrim over imagery, where a
 * translucent wash would vanish — the badge keeps its own backdrop, only the
 * label takes the level color.
 */
export function levelTextStyle(level: string): CSSProperties {
  const l = level.toLowerCase()
  if (l.startsWith("beg")) return { color: "var(--ws-status-success)" }
  if (l.startsWith("int")) return { color: "var(--ws-brand-active)" }
  if (l.startsWith("adv")) return { color: "var(--ws-status-danger)" }
  return {}
}
