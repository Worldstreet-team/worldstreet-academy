import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/actions"
import { WelcomePageClient } from "@/components/welcome/welcome-page-client"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")

export default async function WelcomePage() {
  const user = await getCurrentUser()

  // Not logged in — send to login
  if (!user) redirect(isLocalDev ? "/login" : "https://www.worldstreetgold.com/login")

  return (
    <WelcomePageClient
      firstName={user.firstName}
      hasOnboarded={user.hasOnboarded}
    />
  )
}