import type { Metadata } from "next"

import { ComingSoon } from "@/components/marketing/coming-soon"
import { worldOf } from "@/lib/institution"

export const metadata: Metadata = {
  title: "Opportunity Hub — coming soon",
  robots: { index: false },
}

/**
 * `/opportunity-hub` — the third world (blueprint §6): internships and other
 * opportunities, in the menu as Coming soon (owner voice note, 2026-11-02).
 * There is nothing behind it yet, so it is only the Coming soon page.
 */
export default function OpportunityHubPage() {
  return <ComingSoon world={worldOf("opportunity-hub")} />
}
