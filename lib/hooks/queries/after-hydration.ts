/**
 * React #418 on signed-in pages (live QA, 2026-11-12). On a full page load
 * React hydrates the shell (the rail, the ⌘K search) first and each page's
 * Suspense boundary (app/(platform)/loading.tsx) later, at low priority. The
 * shell's queries start fetching as soon as the shell hydrates; when one of
 * them answered before the page had hydrated, the page's own copy of that
 * query — the dashboard's programs, the bell's unread count, the meetings
 * list — rendered with data where the server had rendered "loading", and React
 * threw the page's server HTML away.
 *
 * The queries the shell shares with pages wait for `afterPageHydration()`
 * before their first request, so every hydration render still sees "loading".
 * The top bar, which every dashboard page renders, calls `markPageHydrated()`
 * once it has hydrated. Pages without one (the lesson player, checkout) open
 * the gate after GATE_CAP_MS. After that first time it is always open: client
 * navigations and refetches never wait. On the server it is open from the start.
 */

const GATE_CAP_MS = 4000

let release: () => void = () => {}

const pageHydrated: Promise<void> =
  typeof window === "undefined"
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        release = resolve
        setTimeout(resolve, GATE_CAP_MS)
      })

/** The page's own content has hydrated (the top bar's first effect). */
export function markPageHydrated(): void {
  release()
}

/** Resolves once the page has hydrated; at once after that, and on the server. */
export function afterPageHydration(): Promise<void> {
  return pageHydrated
}
