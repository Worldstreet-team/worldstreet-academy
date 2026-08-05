import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminBottomNav } from "@/components/admin/bottom-nav"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { MeetingProvider } from "@/components/providers/meeting-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { getCachedUser } from "@/lib/auth/cached"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()

  if (!user) {
    const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    redirect(isLocalDev ? "/login" : "https://www.worldstreetgold.com/login")
  }

  // Hard role gate — the admin console is ADMIN-only.
  if (user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  // Same provider chrome as the student/instructor dashboards — calls and
  // meetings (interview rooms) work in here. The Vivid assistant is injected
  // site-wide by the root layout.
  // The sidebar writes `sidebar_state` when toggled, but nothing read it
  // back — so a collapsed rail sprang open again on every navigation.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <QueryProvider>
      <UserProvider user={user}>
        <CallProvider>
          <MeetingProvider>
            <SidebarProvider defaultOpen={sidebarOpen}>
              <AdminSidebar />
              <SidebarInset>{children}</SidebarInset>
              <AdminBottomNav />
              <CommandSearch />
            </SidebarProvider>
          </MeetingProvider>
        </CallProvider>
      </UserProvider>
    </QueryProvider>
  )
}
