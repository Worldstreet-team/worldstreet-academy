import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Landing } from "@/components/marketing/landing"
import { getCurrentUser } from "@/lib/auth/actions"

export const metadata: Metadata = {
  description:
    "Learn crypto trading, DeFi and risk management from instructors who trade for a living. Structured courses, live sessions and verifiable certificates on WorldStreet Academy.",
}

/**
 * Public landing at `/` — the acquisition surface. Signed-in users skip it
 * entirely; their home is the dashboard, and an interstitial between them and
 * their courses would only be a click tax. They can still reach the landing
 * deliberately at `/home`.
 */
export default async function HomePage() {
  const user = await getCurrentUser()
  if (user) redirect("/dashboard")

  return <Landing />
}
