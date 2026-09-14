import type { Metadata } from "next"
import { Landing } from "@/components/marketing/landing"
import { BRAND } from "@/lib/brand"

export const metadata: Metadata = {
  description: `Master practical, in-demand skills through expert-led programs designed for the new and modern economy. Explore the eight schools of ${BRAND.name}, choose your path and start building capabilities you can apply in the real world.`,
}

/**
 * `/` is the landing page: claim, proof, the real catalogue, real reviews,
 * one way in. Nobody is redirected away — signed-in visitors get in-app CTAs
 * (the Landing resolves that itself) and the navbar already shows Dashboard.
 */
export default function HomePage() {
  return <Landing />
}
