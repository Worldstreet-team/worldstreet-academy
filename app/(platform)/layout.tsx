import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/platform/app-sidebar"
import { PlatformBottomNav } from "@/components/platform/bottom-nav"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { MeetingProvider } from "@/components/providers/meeting-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { getCachedUser } from "@/lib/auth/cached"
import { TranslateScript } from "@/components/translator/translate-script"
import { OnboardingModal } from "@/components/welcome/onboarding-modal"

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()

  if (!user) {
    const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    redirect(isLocalDev ? "/login" : "https://www.worldstreetgold.com/login")
  }

  // The sidebar writes `sidebar_state` when toggled, but nothing read it
  // back — so a collapsed rail sprang open again on every navigation.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <QueryProvider>
      <UserProvider user={user}>
        <CallProvider>
          <MeetingProvider>
            <SidebarProvider defaultOpen={sidebarOpen}>
              <AppSidebar />
              <SidebarInset>
                {children}
              </SidebarInset>
              <PlatformBottomNav />
              <CommandSearch />
              <TranslateScript initialLanguage={user.preferredLanguage} />
              {/* First run: introduce the Academy over the real dashboard
                  rather than on a separate page. */}
              {!user.hasOnboarded && <OnboardingModal userName={user.firstName} />}
            </SidebarProvider>
          </MeetingProvider>
        </CallProvider>
      </UserProvider>
    </QueryProvider>
  )
}
