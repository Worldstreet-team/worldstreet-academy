import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/platform/app-sidebar"
import { PlatformBottomNav } from "@/components/platform/bottom-nav"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { MeetingProvider } from "@/components/providers/meeting-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { VividWrapper } from "@/components/vivid/vivid-wrapper"
import { getCachedUser } from "@/lib/auth/cached"
import { TranslateScript } from "@/components/translator/translate-script"

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

  return (
    <QueryProvider>
      <UserProvider user={user}>
        <CallProvider>
          <MeetingProvider>
            <VividWrapper
              user={{
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
              }}
            >
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  {children}
                </SidebarInset>
                <PlatformBottomNav />
                <CommandSearch />
                <TranslateScript initialLanguage={user.preferredLanguage} />
              </SidebarProvider>
            </VividWrapper>
          </MeetingProvider>
        </CallProvider>
      </UserProvider>
    </QueryProvider>
  )
}
