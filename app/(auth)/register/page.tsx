import { SignUp } from "@clerk/nextjs"
import { redirect } from "next/navigation"

import { registerUrl, safeReturnPath } from "@/lib/auth/login-url"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

type Search = { searchParams: Promise<{ redirect_url?: string | string[] }> }

/**
 * Local development only. Accounts are made only on the WorldStreet hub
 * (owner, 2026-11-03), so in production this page never renders Clerk's form:
 * it sends the visitor to the hub's registration, returning to the page they
 * came from.
 */
export default async function RegisterPage({ searchParams }: Search) {
  if (!isLocalDev) redirect(registerUrl(safeReturnPath((await searchParams).redirect_url)))
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <SignUp
        forceRedirectUrl="/dashboard"
        signInUrl="/login"
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
