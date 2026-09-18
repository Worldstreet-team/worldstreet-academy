import { redirect } from "next/navigation"
import { ShieldCheckIcon } from "lucide-react"
import { BrandLockup } from "@/components/shared/brand-lockup"
import { UserProvider } from "@/components/providers/user-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { getCachedUser } from "@/lib/auth/cached"

/**
 * Checkout runs in its OWN route group, deliberately outside `(platform)`.
 *
 * Paying for a program used to inherit the whole student shell — sidebar,
 * bottom nav, command palette, the first-run tour — so the one screen where a
 * visitor is handing over money was also the screen offering them nine other
 * places to go. This layout is the focused alternative: brand, the order, and
 * nothing to wander off into. The URL is unchanged (`/dashboard/checkout`),
 * so every existing link and the wallet-funding round trip still work.
 *
 * It still gates on auth — a route group is not a security boundary, and
 * checkout must never render for a signed-out visitor. The local-dev Clerk
 * branch is mirrored from `(platform)/layout.tsx`; keep them in step.
 *
 * Providers are only the two the pages actually use: `UserProvider` for the
 * buyer's identity and `QueryProvider` so a completed purchase can invalidate
 * the wallet figures the rest of the app caches. Call, meeting, translate and
 * sidebar providers are intentionally absent.
 */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser()

  if (!user) {
    const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    redirect(isLocalDev ? "/login" : "https://www.worldstreetgold.com/login")
  }

  return (
    <QueryProvider>
      <UserProvider user={user}>
        <div className="flex min-h-svh flex-col bg-ws-page">
          {/* The lockup is not a link: mid-payment is the wrong moment to
              offer a way out of the flow. The page's own Back control is. */}
          <header className="border-b border-ws-hairline">
            <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between gap-4 px-4 md:px-6">
              <BrandLockup alt="" />
              <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ws-muted">
                <ShieldCheckIcon size={14} aria-hidden />
                Secure checkout
              </p>
            </div>
          </header>
          {/* justify-center parks a short order in the middle of the screen;
              a tall one (three packages expanded) simply grows the main and
              scrolls, because the scroll container is the document, not this
              box — so nothing gets clipped off the top. */}
          <main className="flex flex-1 flex-col justify-center">{children}</main>
        </div>
      </UserProvider>
    </QueryProvider>
  )
}
