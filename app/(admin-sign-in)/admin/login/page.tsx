import type { Metadata } from "next"
import { AdminSignInPage } from "@/components/admin/admin-sign-in-page"

// Outside the (admin) group on purpose: its layout turns away anyone who isn't an admin yet.
export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } }

type Search = { searchParams: Promise<{ next?: string | string[] }> }

export default async function AdminLoginPage({ searchParams }: Search) {
  return <AdminSignInPage level="admin" next={(await searchParams).next} />
}
