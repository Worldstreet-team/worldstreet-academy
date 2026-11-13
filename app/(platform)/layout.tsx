import { Suspense } from "react"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/platform/app-sidebar"
import { PlatformBottomNav } from "@/components/platform/bottom-nav"
import { GateGuard, GatedProvider } from "@/components/platform/gate-guard"
import { CommandSearch } from "@/components/shared/command-search"
import { UserProvider } from "@/components/providers/user-provider"
import { CallProvider } from "@/components/providers/call-provider"
import { MeetingProvider } from "@/components/providers/meeting-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { getCachedUser } from "@/lib/auth/cached"
import { claimWaitingGrants } from "@/lib/access-grants"
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
    // Signed in, but the account couldn't be loaded (the database didn't answer,
    // or the first sync failed). The middleware already sent signed-out visitors
    // to the hub, so bouncing this one there only landed them on the hub's own
    // dashboard, away from the Academy. The error page offers "Try again"
    // instead (2026-11-12).
    if ((await auth()).userId) throw new Error("Your account could not be loaded")
    const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    redirect(isLocalDev ? "/login" : "https://www.worldstreetgold.com/login")
  }

  // No dashboard without paying (owner meeting, 2026-10-03): a learner without
  // an active or completed enrollment is sent away — to the pending page while
  // an ESPEE proof of theirs waits on an admin, else to the schools (the one
  // the landing's `wsa_school` cookie names, else all seven) to choose a
  // program and a package there. A saved school no longer opens the dashboard.
  // Fails OPEN — a gate that cannot read its state must never lock anyone out.
  // `redirect()` throws by design, so it stays outside the catch.
  // A learner who hasn't paid yet reaches only the gate's exempt pages, and the
  // rail then lists just those (live QA, 2026-11-12). Fails open like the gate.
  let gated = false
  // Where the gate sends this learner; also used in the browser (GateGuard), because
  // this layout doesn't re-render when they move between pages under it (2026-11-12).
  let gateTarget = "/schools?start=1"
  if (user.role === "USER") {
    const pathname = (await headers()).get("x-next-pathname") ?? ""
    const gate = await getStartGateState(user.id).catch(() => null)
    gated = Boolean(
      gate && needsSchoolChoice({ role: user.role, instructorStatus: user.instructorStatus, pathname: "/dashboard", ...gate })
    )
    if (gate) {
      gateTarget = gate.hasOpenProof
        ? "/dashboard/checkout/pending"
        : schoolsPathFor((await cookies()).get(START_SCHOOL_COOKIE)?.value)
    }
    if (
      gate &&
      needsSchoolChoice({ role: user.role, instructorStatus: user.instructorStatus, pathname, ...gate })
    ) {
      // A payment an admin recorded for this email (team, 2026-11-06) opens
      // here if sign-in didn't open it (the account was made in the mobile
      // app, say, or the first try failed). Only runs for a learner it would send away.
      if ((await claimWaitingGrants(user)) === 0) {
        // 2026-11-12: the same target, now worked out above for GateGuard too. Was:
        // redirect(
        //   gate.hasOpenProof
        //     ? "/dashboard/checkout/pending"
        //     : schoolsPathFor((await cookies()).get(START_SCHOOL_COOKIE)?.value)
        // )
        redirect(gateTarget)
      }
      // That waiting payment just opened the dashboard.
      gated = false
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
            {/* 2026-11-12: tells each page's top bar this learner is behind the gate (gate-guard.tsx). */}
            <GatedProvider gated={gated}>
            {/* The student rail floats (variant="floating"). Its icon-mode
                width is the hub's 4.5rem: room for the 28px icon chips inside
                the rail's inset. The instructor and admin rails keep 3rem. */}
            <SidebarProvider
              defaultOpen={sidebarOpen}
              style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
            >
              <AppSidebar gated={gated} />
              <SidebarInset>
                {children}
              </SidebarInset>
              {/* Every tab of the phone bar is behind the gate, so it waits until they've paid. */}
              {!gated && <PlatformBottomNav />}
              {gated && <GateGuard target={gateTarget} />}
              <CommandSearch />
              <TranslateScript initialLanguage={user.preferredLanguage} />
              {/* First run: a short tour of the real dashboard, not a slideshow
                  about it. Always mounted so /dashboard?tour=1 can replay it;
                  it reads the query string, hence the boundary. */}
              <Suspense fallback={null}>
                <DashboardTour autoStart={!user.hasOnboarded} firstName={user.firstName} />
              </Suspense>
            </SidebarProvider>
            </GatedProvider>
          </MeetingProvider>
        </CallProvider>
      </UserProvider>
    </QueryProvider>
  )
}
