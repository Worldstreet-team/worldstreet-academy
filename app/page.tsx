import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/actions"
import { WelcomePageClient } from "@/components/welcome/welcome-page-client"
import { buildLoginRedirectUrl } from "@/lib/auth/redirect"

export default async function WelcomePage() {
  const user = await getCurrentUser()

  // Not logged in — send to login
  if (!user) redirect(await buildLoginRedirectUrl("/"))

  return (
    <WelcomePageClient
      firstName={user.firstName}
      hasOnboarded={user.hasOnboarded}
    />
  )
}