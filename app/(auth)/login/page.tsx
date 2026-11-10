import { SignIn } from "@clerk/nextjs"
import { redirect } from "next/navigation"

import { loginUrl, safeReturnPath } from "@/lib/auth/login-url"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

type Search = { searchParams: Promise<{ redirect_url?: string | string[] }> }

/**
 * Local development only. People sign in only on the WorldStreet hub (owner,
 * 2026-11-03: they "should not be able to log in or register on the
 * academy"), so in production this page never renders Clerk's form: it sends
 * the visitor to the hub's sign-in, returning to the page they came from.
 */
export default async function LoginPage({ searchParams }: Search) {
  if (!isLocalDev) redirect(loginUrl(safeReturnPath((await searchParams).redirect_url)))
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <SignIn
        forceRedirectUrl="/dashboard"
        signUpUrl="/register"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg border border-border rounded-lg",
            headerTitle: "text-foreground",
            headerSubtitle: "text-muted-foreground",
            socialButtonsBlockButton: "border-border",
            formButtonPrimary: "bg-primary hover:bg-primary/90",
          },
        }}
      />
    </div>
  )
}
