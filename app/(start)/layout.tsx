import { redirect } from "next/navigation"
import { BrandLockup } from "@/components/shared/brand-lockup"
import { getCachedUser } from "@/lib/auth/cached"

/**
 * The school picker runs in its OWN route group, outside `(platform)`, for the
 * reason checkout does: a learner choosing where to begin should not also be
 * offered a sidebar of nine other places to go. The URL stays under
 * `/dashboard`, so middleware protects it and a guest's deep link
 * (`/dashboard/start?school=…`) survives the sign-in round trip.
 *
 * A route group is not a security boundary: this still gates on auth. The
 * local-dev Clerk branch mirrors `(platform)/layout.tsx`; keep them in step.
 */
export default async function StartLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser()

  if (!user) {
    const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    redirect(isLocalDev ? "/login" : "https://www.worldstreetgold.com/login")
  }

  return (
    <div className="flex min-h-svh flex-col bg-ws-page">
      <header className="border-b border-ws-hairline">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <BrandLockup alt="" />
          <p className="min-w-0 truncate text-[13px] font-medium text-ws-muted">
            {user.firstName ? `Welcome, ${user.firstName}` : "Welcome"}
          </p>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
