import { Suspense } from "react"
import { cookies, headers } from "next/headers"
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
import { START_SCHOOL_COOKIE, needsSchoolChoice, schoolsPathFor } from "@/lib/start-gate"
import { getStartGateState } from "@/lib/start-gate-state"
import { TranslateScript } from "@/components/translator/translate-script"
import { DashboardTour } from "@/components/welcome/dashboard-tour"

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

  // School first (owner, 2026-09-16; plan D15, 2026-09-18): a learner with no
  // enrollment and no saved school is sent to the schools — the one the
  // landing's `wsa_school` cookie names, else all eight — to choose a program
  // and a package there. Fails OPEN — a gate that cannot read its state must
  // never lock anyone out. `redirect()` throws by design, so it stays outside
  // the catch.
  if (user.role === "USER") {
    const pathname = (await headers()).get("x-next-pathname") ?? ""
    const gate = await getStartGateState(user.id).catch(() => null)
    if (
      gate &&
      needsSchoolChoice({ role: user.role, instructorStatus: user.instructorStatus, pathname, ...gate })
    ) {
      redirect(schoolsPathFor((await cookies()).get(START_SCHOOL_COOKIE)?.value))
    }
  }

  // The sidebar writes `sidebar_state` when toggled, but nothing read it
  // back — so a collapsed rail sprang open again on every navigation.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <QueryProvider>
      <UserProvider user={user}>
        <CallProvider>
          <MeetingProvider>
            {/* The student rail floats (variant="floating"). Its icon-mode
                width is the hub's 4.5rem: room for the 28px icon chips inside
                the rail's inset. The instructor and admin rails keep 3rem. */}
            <SidebarProvider
              defaultOpen={sidebarOpen}
              style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
            >
              <AppSidebar />
              <SidebarInset>
                {children}
              </SidebarInset>
              <PlatformBottomNav />
              <CommandSearch />
              <TranslateScript initialLanguage={user.preferredLanguage} />
              {/* First run: a short tour of the real dashboard, not a slideshow
                  about it. Always mounted so /dashboard?tour=1 can replay it;
                  it reads the query string, hence the boundary. */}
              <Suspense fallback={null}>
                <DashboardTour autoStart={!user.hasOnboarded} firstName={user.firstName} />
              </Suspense>
            </SidebarProvider>
          </MeetingProvider>
        </CallProvider>
      </UserProvider>
    </QueryProvider>
  )
}
