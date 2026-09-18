import Link from "next/link"
import { redirect } from "next/navigation"
import { BrandLockup } from "@/components/shared/brand-lockup"
import { getCachedUser } from "@/lib/auth/cached"
import { needsSchoolChoice } from "@/lib/start-gate"
import { getStartGateState } from "@/lib/start-gate-state"
import { cn } from "@/lib/utils"

/**
 * The school picker runs in its OWN route group, outside `(platform)`, for the
 * reason checkout does: a learner choosing where to begin should not also be
 * offered a sidebar of nine other places to go. The URL stays under
 * `/dashboard`, so middleware protects it and a guest's deep link
 * (`/dashboard/start?school=…`) survives the sign-in round trip.
 *
 * A route group is not a security boundary: this still gates on auth. The
 * local-dev Clerk branch mirrors `(platform)/layout.tsx`; keep them in step.
 *
 * The way out is quiet: the lockup goes home, and a learner the school-first
 * gate would let through (one with an enrollment or a saved school) gets a
 * muted link back to the dashboard. A learner it would bounce straight back
 * here is not offered one. If the gate's state can't be read, the link shows —
 * the gate itself fails open too.
 */
export default async function StartLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser()

  if (!user) {
    const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    redirect(isLocalDev ? "/login" : "https://www.worldstreetgold.com/login")
  }

  const gate = await getStartGateState(user.id).catch(() => null)
  const canLeave =
    gate === null ||
    !needsSchoolChoice({
      role: user.role,
      instructorStatus: user.instructorStatus,
      pathname: "/dashboard",
      ...gate,
    })

  return (
    <div className="flex min-h-svh flex-col bg-ws-page">
      <header className="border-b border-ws-hairline">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-brand/40"
          >
            <BrandLockup alt="" />
          </Link>
          <div className="flex min-w-0 items-center gap-5">
            {/* On a phone the way out wins the room over the greeting. */}
            <p
              className={cn(
                "min-w-0 truncate text-[13px] font-medium text-ws-muted",
                canLeave && "hidden sm:block"
              )}
            >
              {user.firstName ? `Welcome, ${user.firstName}` : "Welcome"}
            </p>
            {/* Text only: the page's own step-back link already carries the
                arrow, and two arrows would compete. */}
            {canLeave && (
              <Link
                href="/dashboard"
                className="shrink-0 text-[13px] font-medium text-ws-muted underline decoration-ws-hairline underline-offset-4 transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary hover:decoration-current"
              >
                Back to dashboard
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
