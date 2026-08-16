/**
 * Landing easing vocabulary — single source of truth for the JS side.
 * The same curves are declared as CSS vars (`--land-ease-inertia`,
 * `--land-ease-exit`) on the landing root div in landing.tsx.
 */

/** Expo-out: fast launch, long settle. Entrances, reveals, hero moments. */
export const EASE_INERTIA = [0.16, 1, 0.3, 1] as const

/** `--ws-ease-rise` — card/list reveals, 500–700ms. */
export const EASE_LUX = [0.22, 1, 0.36, 1] as const

/** `--ws-ease` — micro/hover/chromatic, 160–200ms. */
export const EASE_STANDARD = [0.2, 0, 0, 1] as const

/** Outgoing hero slides only. */
export const EASE_EXIT = [0.7, 0, 0.84, 0] as const

/** Marquee ramp-in only (cubic-bezier(0.33, 1, 0.68, 1) ≈ ease-out-cubic). */
export const EASE_GLIDE = [0.33, 1, 0.68, 1] as const

/** Scalar version of EASE_GLIDE for hand-rolled rAF ramps. */
export function glide(t: number): number {
  const c = Math.min(Math.max(t, 0), 1)
  return 1 - Math.pow(1 - c, 3)
}
