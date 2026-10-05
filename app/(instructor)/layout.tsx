import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { InstructorSidebar } from "@/components/instructor/instructor-sidebar"
import { InstructorBottomNav } from "@/components/instructor/bottom-nav"
import { SellerRouteGuard } from "@/components/instructor/seller-route-guard"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { MeetingProvider } from "@/components/providers/meeting-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { getCachedUser } from "@/lib/auth/cached"
import { getSellerStatus } from "@/lib/seller"
import { SELLER_HOME, sellerMayOpen } from "@/lib/marketplace"

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

  // Instructor portal is gated: approved instructors and admins get all of
  // it. An approved marketplace seller (a USER with sellerStatus "approved",
  // owner 2026-10-05 — never a role change) gets only the course tools:
  // courses, add/edit, lessons, settings and profile (lib/marketplace.ts).
  // A seller still in review (or turned down) goes back to their application;
  // everyone else to the instructor application flow.
  const isFaculty = user.role === "INSTRUCTOR" || user.role === "ADMIN"
  const sellerStatus = isFaculty ? "none" : await getSellerStatus(user.id)
  const seller = sellerStatus === "approved"
  if (!isFaculty && !seller) {
    redirect(sellerStatus === "applied" || sellerStatus === "rejected" ? "/dashboard/sell/apply" : "/dashboard/become-instructor")
  }
  if (seller) {
    // Full loads only — SellerRouteGuard covers client-side navigation.
    const pathname = (await headers()).get("x-next-pathname") ?? ""
    if (pathname && !sellerMayOpen(pathname)) redirect(SELLER_HOME)
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
              <InstructorSidebar seller={seller} />
              <SidebarInset>
                {children}
              </SidebarInset>
              <InstructorBottomNav seller={seller} />
              <CommandSearch />
              {seller && <SellerRouteGuard />}
            </SidebarProvider>
          </MeetingProvider>
        </CallProvider>
      </UserProvider>
    </QueryProvider>
  )
}
