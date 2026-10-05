"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { SELLER_HOME, sellerMayOpen } from "@/lib/marketplace"

/**
 * The client half of the seller gate. A layout renders once and is kept on
 * client-side navigation, so the instructor layout's pathname check only sees
 * full loads; this catches an in-app link to a faculty-only route (overview,
 * meetings, messages, certificates, analytics, exams, assignments) and sends
 * the seller to their course list. Their data stays faculty-gated server-side.
 */
export function SellerRouteGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const blocked = !sellerMayOpen(pathname)

  React.useEffect(() => {
    if (blocked) router.replace(SELLER_HOME)
  }, [blocked, router])

  return null
}
