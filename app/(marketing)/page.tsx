import type { Metadata } from "next"
import { Landing } from "@/components/marketing/landing"

export const metadata: Metadata = {
  description:
    "Learn crypto trading, DeFi and risk management from instructors who trade for a living. Structured courses, live classes, real exams and signed certificates on WorldStreet Academy.",
}

/**
 * `/` is the landing page: claim, proof, the real catalogue, real reviews,
 * one way in. Nobody is redirected away — signed-in visitors get in-app CTAs
 * (the Landing resolves that itself) and the navbar already shows Dashboard.
 */
export default function HomePage() {
  return <Landing />
}
