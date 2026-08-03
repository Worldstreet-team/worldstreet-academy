/**
 * Design-system values used by the welcome/onboarding screens.
 *
 * These resolve through the shared WorldStreet tokens (`app/ws-tokens.css`,
 * vendored from `design-tokens/tokens.css`) rather than hardcoding hexes, so
 * the Academy picks up its `platform` palette — near-black #0B0B0F and gold
 * #FFCC29 — instead of the `shell` stone + #EAB308 used by wallet/auth.
 *
 * They're plain strings because these components apply them via inline
 * `style`, where `var(--ws-*)` resolves normally.
 */

/** Brand gold fill for primary actions. */
export const GOLD = "var(--ws-brand-primary)"
export const GOLD_HOVER = "var(--ws-brand-active)"
/** The only legible foreground on gold. */
export const ON_GOLD = "var(--ws-brand-on-primary)"

/**
 * Academy's platform accent. The system allows platform hues only as ~13%
 * washes behind icons and chips — never as a fill, never as large surfaces.
 */
export const ACADEMY_ACCENT = "var(--ws-accent-academy)"
export const ACADEMY_ACCENT_WASH = "color-mix(in srgb, var(--ws-accent-academy) 13%, transparent)"

/** Radius ladder (01-foundations): xs 4 · sm 7 · md 10 · lg 13. */
export const RADIUS_SM = "7px"
export const RADIUS_MD = "10px"
export const RADIUS_LG = "13px"

/** Control height for primary actions (04-components: Button base). */
export const CONTROL_H = "52px"

/** Surface ladder: page → sunken → surface → raised. */
export const STONE_BG = "var(--ws-bg-page)"
export const STONE_SUNKEN = "var(--ws-bg-sunken)"
export const STONE_SURFACE = "var(--ws-bg-surface)"
export const STONE_SURFACE_ALT = "var(--ws-bg-raised)"
export const STONE_TEXT = "var(--ws-text-primary)"
export const STONE_MUTED = "var(--ws-text-muted)"
export const STONE_SUBTLE = "var(--ws-text-subtle)"

/**
 * Height of the marquee media band on desktop. Shared so the welcome screens
 * can reserve exactly that much space and centre their content in what's left.
 */
export const MARQUEE_BAND_LG = "52vh"

/** Hairline dividers. */
export const HAIRLINE_DARK = "var(--ws-border-hairline)"
export const HAIRLINE_LIGHT = "rgba(12,10,9,0.08)"
