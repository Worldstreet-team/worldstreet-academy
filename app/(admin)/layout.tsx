import { cookies, headers } from "next/headers"
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
import { adminLoginUrl } from "@/lib/auth/login-url"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()

  // Hard role gate — the admin console is ADMIN-only. Anyone else, signed in
  // or not, gets the panel's own sign-in and comes back here after it (Owen,
  // 2026-11-11). Local Clerk test keys keep the local flow.
  if (!user || user.role !== "ADMIN") {
    const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    if (isLocalDev) redirect(user ? "/dashboard" : "/login")
    const h = await headers()
    redirect(adminLoginUrl(`${h.get("x-next-pathname") ?? "/admin"}${h.get("x-next-search") ?? ""}`))
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
