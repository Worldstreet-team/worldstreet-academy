import type { Metadata } from "next"
import { Landing } from "@/components/marketing/landing"
import { SITE_DESCRIPTION } from "@/lib/brand"
import { appUrl } from "@/lib/app-url"

export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: { canonical: appUrl("/") },
}

/**
 * `/` is the landing page: claim, proof, the real catalogue, real reviews,
 * one way in. Nobody is redirected away — signed-in visitors get in-app CTAs
 * (the Landing resolves that itself) and the navbar already shows Dashboard.
 */
export default function HomePage() {
  return <Landing />
}
