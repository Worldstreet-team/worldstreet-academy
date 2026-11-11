import Link from "next/link"
import { redirect } from "next/navigation"
import { BrandLockup } from "@/components/shared/brand-lockup"
import { Button } from "@/components/ui/button"
import { AdminLoginForm } from "@/components/admin/admin-login-form"
import { isSuperAdmin } from "@/lib/admin-levels"
import { getCachedUser } from "@/lib/auth/cached"
import { ADMIN_LOGIN_PATH, SUPER_ADMIN_LOGIN_PATH, loginUrl, safeAdminReturnPath } from "@/lib/auth/login-url"
import { BRAND } from "@/lib/brand"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

/**
 * /admin/login and /superadmin (Owen, 2026-11-11): the admin panels' own
 * sign-in, open to anyone, signed in or not. An admin already signed in goes
 * straight to the panel; anyone else gets the form. Local Clerk test keys keep
 * the local /login, like middleware.ts.
 */
export async function AdminSignInPage({
  level,
  next,
}: {
  level: "admin" | "super"
  next: string | string[] | undefined
}) {
  const returnPath = safeAdminReturnPath(next)
  if (isLocalDev) redirect(loginUrl(returnPath))

  const user = await getCachedUser()
  if (user?.role === "ADMIN" && (level === "admin" || isSuperAdmin(user))) redirect(returnPath)
  const signedInAs = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : null

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="inline-flex">
          <BrandLockup eyebrow={level === "super" ? "Super admin" : "Admin"} alt={BRAND.name} />
        </Link>
        <section className="space-y-5 rounded-[20px] border border-ws-hairline bg-ws-surface p-6">
          <header className="space-y-1.5">
            <h1 className="text-xl font-semibold text-ws-primary">
              {level === "super" ? "Super admin sign in" : "Admin sign in"}
            </h1>
            <p className="text-sm text-ws-muted">Use the email and password of your WorldStreet admin account.</p>
          </header>
          {signedInAs && (
            <p className="rounded-[12px] bg-ws-chip px-3 py-2 text-xs text-ws-muted">
              You&apos;re signed in as {signedInAs}. Signing in here switches this browser to the admin account.
            </p>
          )}
          <AdminLoginForm level={level} next={returnPath} />
          {/* Most admins sign in to WorldStreet with Google and have no password (checked
              2026-11-11): they use the hub's sign-in, which returns them here. */}
          <div className="space-y-2.5 border-t border-ws-hairline pt-4">
            <p className="text-xs text-ws-muted">
              Sign in to WorldStreet with Google, or use two-step sign-in? Use the WorldStreet sign-in instead. It brings
              you back here.
            </p>
            <Button variant="outline" className="h-11 w-full" render={<a href={loginUrl(returnPath)} />}>
              Sign in on WorldStreet
            </Button>
          </div>
        </section>
        <p className="text-center text-xs text-ws-muted">
          {level === "super" ? (
            <>
              Regular admin? <Link href={ADMIN_LOGIN_PATH} className="text-ws-primary underline-offset-4 hover:underline">Admin sign in</Link>
            </>
          ) : (
            <>
              Super admin? <Link href={SUPER_ADMIN_LOGIN_PATH} className="text-ws-primary underline-offset-4 hover:underline">Super admin sign in</Link>
            </>
          )}
        </p>
      </div>
    </main>
  )
}
