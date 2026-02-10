import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/platform/app-sidebar"
import { PlatformBottomNav } from "@/components/platform/bottom-nav"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { MeetingProvider } from "@/components/providers/meeting-provider"
import { getCurrentUser } from "@/lib/auth"

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/unauthorized")
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
