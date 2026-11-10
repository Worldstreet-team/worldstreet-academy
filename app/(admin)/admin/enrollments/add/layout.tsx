import { notFound } from "next/navigation"
import { getCachedUser } from "@/lib/auth/cached"
import { isSuperAdmin } from "@/lib/admin-levels"

/**
 * /admin/enrollments/add — recording someone who paid outside the platform,
 * super admins only (CTO, 2026-11-08): everyone pays through WorldStreet, and
 * an outside payment is reconciled with the CTO first. Regular admins get a
 * 404, like /admin/team. The actions re-check with requireSuperAdmin: this gate
 * is UX, not the security boundary.
 */
export default async function AddPaidLearnersLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser()
  if (!user || !isSuperAdmin(user)) notFound()
  return children
}
