import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/platform/app-sidebar"
import { PlatformBottomNav } from "@/components/platform/bottom-nav"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { MeetingProvider } from "@/components/providers/meeting-provider"
import { getCurrentUser } from "@/lib/auth"
import { buildLoginRedirectUrl } from "@/lib/auth/redirect"

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    const headersList = await headers()
    const currentPath = headersList.get("x-next-pathname") || "/dashboard"
    redirect(buildLoginRedirectUrl(currentPath))
  }

  return (
    <UserProvider user={user}>
      <CallProvider>
        <MeetingProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {children}
            </SidebarInset>
            <PlatformBottomNav />
            <CommandSearch />
          </SidebarProvider>
        </MeetingProvider>
      </CallProvider>
    </UserProvider>
  )
}
