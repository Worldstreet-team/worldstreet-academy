import type { Metadata } from "next"
import { Landing } from "@/components/marketing/landing"

export const metadata: Metadata = {
  title: "Home",
  description:
    "Learn crypto trading, DeFi and risk management from instructors who trade for a living. Structured courses, live sessions and verifiable certificates on WorldStreet Academy.",
}

/**
 * `/home` — the same landing as `/`, but with no signed-in redirect, so users
 * inside the app (e.g. via the sidebar logo) can view the marketing page.
 */
export default function LandingHomePage() {
  return <Landing />
}
