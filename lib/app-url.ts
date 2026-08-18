/**
 * The public base URL used to build absolute links that leave the app —
 * email bodies, cron-issued meeting links, admin review links.
 *
 * This exists because a loopback value shipped in the deployment env: the
 * production env template carried `NEXT_PUBLIC_APP_URL=http://localhost:3000`,
 * and since the variable was *set*, every `process.env.X || "https://..."`
 * fallback in the codebase happily used it. Emails went out with links only
 * the container itself could open.
 *
 * So a set-but-unusable value is treated as absent. Resolution order:
 *   1. NEXT_PUBLIC_APP_URL   — the intended knob
 *   2. SITE_URL              — already correct in the production env
 *   3. the production origin — last resort
 *
 * A loopback host is only honoured outside production, where it is what you
 * actually want. Note this means `next start` on a laptop resolves to the
 * production origin; set NODE_ENV=development to keep localhost there.
 */

const PRODUCTION_ORIGIN = "https://academy.worldstreetgold.com"

const LOOPBACK =
  /^https?:\/\/(localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[::1\]|::1)(:\d+)?$/i

function normalize(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, "")
  return trimmed ? trimmed : null
}

function resolveAppUrl(): string {
  const inProduction = process.env.NODE_ENV === "production"

  for (const candidate of [
    normalize(process.env.NEXT_PUBLIC_APP_URL),
    normalize(process.env.SITE_URL),
  ]) {
    if (!candidate) continue
    if (inProduction && LOOPBACK.test(candidate)) continue
    return candidate
  }

  return PRODUCTION_ORIGIN
}

/** Absolute origin, no trailing slash. */
export const APP_URL = resolveAppUrl()

/** Joins a root-relative path onto APP_URL. */
export function appUrl(path: string): string {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`
}
