"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { needsSchoolChoice } from "@/lib/start-gate"

/**
 * The school-first gate for in-app navigation (2026-11-12). The (platform)
 * layout runs the gate on the server, but a layout doesn't re-render when the
 * learner moves between pages under it, so a learner who hasn't paid could
 * reach any dashboard page from an exempt one through a breadcrumb, the ⌘K
 * search or a link in the page. Mounted by the layout only for that learner;
 * it sends them where the server gate would. `target` is the layout's own
 * choice (the pending page or the schools).
 */
const GatedContext = React.createContext(false)

/**
 * Whether this learner is behind the gate (2026-11-12), for the top bar: each
 * page renders its own, so the layout's `gated` can't reach it as a prop. The
 * bar then skips links the gate would bounce (the wallet, profile, settings).
 * Instructor and admin layouts don't mount it, so the default is "not gated".
 */
export function GatedProvider({ gated, children }: { gated: boolean; children: React.ReactNode }) {
  return <GatedContext.Provider value={gated}>{children}</GatedContext.Provider>
}

export function useGated(): boolean {
  return React.useContext(GatedContext)
}

export function GateGuard({ target }: { target: string }) {
  const pathname = usePathname()
  const router = useRouter()

  React.useEffect(() => {
    if (needsSchoolChoice({ role: "USER", instructorStatus: "none", hasAccess: false, pathname })) {
      router.replace(target)
    }
  }, [pathname, router, target])

  return null
}
