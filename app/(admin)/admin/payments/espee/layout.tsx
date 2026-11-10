import { notFound } from "next/navigation"
import { getCachedUser } from "@/lib/auth/cached"
import { isSuperAdmin } from "@/lib/admin-levels"

/**
 * /admin/payments/espee/* — transfer receipts, super admins only (CTO,
 * 2026-11-08: "All payments route through WorldStreet"). Transfers are closed;
 * this queue only holds proofs sent before, which the super admin reconciles.
 * Regular admins get a 404, like /admin/team. The actions re-check with
 * requireSuperAdmin: this gate is UX, not the security boundary.
 */
export default async function TransferReceiptsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser()
  if (!user || !isSuperAdmin(user)) notFound()
  return children
}
