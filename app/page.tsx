import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/actions"
import { WelcomePageClient } from "@/components/welcome/welcome-page-client"

export default async function WelcomePage() {
  const user = await getCurrentUser()

  // Redirect already-onboarded users straight to dashboard
  if (user?.hasOnboarded) {
    redirect("/dashboard")
  }

  return (
    <WelcomePageClient
      firstName={user?.firstName ?? null}
      hasOnboarded={user?.hasOnboarded ?? false}
      isAuthenticated={!!user}
    />
  )
}