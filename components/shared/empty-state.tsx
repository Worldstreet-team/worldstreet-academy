import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

/**
 * Empty state, per the design system (04-components · EmptyState):
 * centered column · art (or 64px icon chip) · title SemiBold 16 · caption
 * Regular 13 muted (max ~36ch) · one Primary button. Never more than one
 * action.
 *
 * Prefer passing `art` — a spot illustration from
 * `components/shared/illustrations.tsx` (e.g. `<ArtBookmarks />`). Those
 * pieces are drawn on the `--ws-*` tokens and carry their own soft gold halo,
 * so no extra halo is layered behind them here. The `icon` chip remains as the
 * fallback for surfaces that don't have a dedicated illustration yet; the chip
 * gets a whisper-volume halo so the state reads intentional rather than like a
 * failed load.
 */
type EmptyStateProps = {
  /** Spot illustration (preferred) — rendered ~176px wide above the title. */
  art?: React.ReactNode
  /** Fallback icon-chip treatment when no `art` exists for the surface. */
  icon?: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export function EmptyState({ art, icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {art ? (
        <div aria-hidden className="mb-4 w-44">
          {art}
        </div>
      ) : (
        icon && (
          <div className="relative mb-5">
            {/* Halo — brand at whisper volume, so the circle doesn't float in a void */}
            <div
              aria-hidden
              className="absolute -inset-6 rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, color-mix(in srgb, var(--ws-brand-primary) 7%, transparent), transparent)",
              }}
            />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-ws-hairline bg-ws-raised">
              <RenderIcon icon={icon}  size={26} className="text-ws-muted" />
            </div>
          </div>
        )
      )}

      <h3 className="text-base font-semibold text-ws-primary">{title}</h3>
      <p className="mt-1.5 max-w-[36ch] text-[13px] leading-relaxed text-ws-muted">
        {description}
      </p>

      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-sm bg-ws-brand px-5 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
