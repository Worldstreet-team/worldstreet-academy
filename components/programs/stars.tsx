import { StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Five rating stars, filled to the nearest half. Orange `text-ws-rating` is
 * the one sanctioned star colour; the unfilled part sits on the track tone.
 * Decorative by default — the caller prints the number beside it; pass
 * `label` when the stars stand alone.
 */
export function Stars({ rating, size = 14, label, className }: {
  rating: number
  size?: number
  label?: string
  className?: string
}) {
  const halves = Math.round(Math.min(5, Math.max(0, rating)) * 2)
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = halves >= star * 2 ? 1 : halves === star * 2 - 1 ? 0.5 : 0
        return (
          <span key={star} className="relative inline-flex" style={{ width: size, height: size }}>
            <StarIcon size={size} className="absolute inset-0 text-ws-subtle/45" fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: fill === 1 ? size : size / 2 }}>
                {/* max-w-none: the base layer caps svg at 100% of its box,
                    which would squash this half-width clip instead of cutting it. */}
                <StarIcon size={size} className="max-w-none text-ws-rating" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}
