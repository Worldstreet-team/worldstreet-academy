import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar"
import { InstructorBottomNav } from "@/components/instructor/bottom-nav"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { MeetingProvider } from "@/components/providers/meeting-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { getCachedUser } from "@/lib/auth/cached"

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()

  if (!user) {
    const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    redirect(isLocalDev ? "/login" : "https://www.worldstreetgold.com/login")
  }

  // Instructor portal is gated: only approved instructors (and admins) enter.
  // Everyone else is routed to the application flow.
  if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") {
    redirect("/dashboard/become-instructor")
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
