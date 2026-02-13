import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar"
import { InstructorBottomNav } from "@/components/instructor/bottom-nav"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { MeetingProvider } from "@/components/providers/meeting-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { getCurrentUser } from "@/lib/auth"
import { buildLoginRedirectUrl } from "@/lib/auth/redirect"

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    const headersList = await headers()
    const currentPath = headersList.get("x-next-pathname") || "/instructor"
    redirect(await buildLoginRedirectUrl(currentPath))
  }

  // Allow any authenticated user to access instructor dashboard
  // They can create and manage their own courses

  return (
    <QueryProvider>
      <UserProvider user={user}>
        <CallProvider>
          <MeetingProvider>
            <SidebarProvider>
              <InstructorSidebar />
              <SidebarInset>
                {children}
              </SidebarInset>
              <InstructorBottomNav />
              <CommandSearch />
            </SidebarProvider>
          </MeetingProvider>
        </CallProvider>
      </UserProvider>
    </QueryProvider>
  )
}
