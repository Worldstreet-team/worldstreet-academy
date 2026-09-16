/**
 * The dashboard tour (`components/welcome/dashboard-tour.tsx`) spotlights
 * real shell elements, found by `data-tour="<key>"`. The keys and the one
 * event the tour sends the sidebar live here so the shell never imports the
 * tour itself.
 */

/** Sent with a NavGroup id as `detail`; a folded group opens so its row can be spotlit. */
export const TOUR_OPEN_GROUP_EVENT = "ws-tour:open-group"

/** Sidebar rows the tour points at, by href. */
const NAV_TOUR_KEYS: Record<string, string> = {
  "/dashboard/courses": "browse-nav",
  "/dashboard/wallet": "wallet-nav",
  "/dashboard/help": "help-nav",
}

export function navTourKey(href: string): string | undefined {
  return NAV_TOUR_KEYS[href]
}

/** `/dashboard?tour=1` replays the tour; the Help page links here. */
export const TOUR_REPLAY_HREF = "/dashboard?tour=1"
