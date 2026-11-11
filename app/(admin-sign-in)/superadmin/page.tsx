import type { Metadata } from "next"
import { AdminSignInPage } from "@/components/admin/admin-sign-in-page"

// The super admin's door into the same /admin panel (Owen, 2026-11-11).
export const metadata: Metadata = { title: "Super admin sign in", robots: { index: false, follow: false } }

type Search = { searchParams: Promise<{ next?: string | string[] }> }

export default async function SuperAdminLoginPage({ searchParams }: Search) {
  return <AdminSignInPage level="super" next={(await searchParams).next} />
}
