import { notFound } from "next/navigation"
import { getCachedUser } from "@/lib/auth/cached"
import { isSuperAdmin } from "@/lib/admin-levels"
import { TeamConsole } from "@/components/admin/team-console"

/** /admin/team — super admins only (D32). Regular admins get a 404; non-admins never pass the (admin) layout.
 *  The actions re-check with requireSuperAdmin: this gate is UX, not the security boundary. */
export default async function AdminTeamPage() {
  const user = await getCachedUser()
  if (!user || !isSuperAdmin(user)) notFound()
  return <TeamConsole />
}
