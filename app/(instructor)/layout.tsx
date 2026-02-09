import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar"
import { InstructorBottomNav } from "@/components/instructor/bottom-nav"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { getCurrentUser } from "@/lib/auth"

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/unauthorized")
  }

  // Allow any authenticated user to access instructor dashboard
  // They can create and manage their own courses

  return (
    <UserProvider user={user}>
      <CallProvider>
        <SidebarProvider>
          <InstructorSidebar />
          <SidebarInset>
            {children}
          </SidebarInset>
          <InstructorBottomNav />
          <CommandSearch />
        </SidebarProvider>
      </CallProvider>
    </UserProvider>
  )
}
