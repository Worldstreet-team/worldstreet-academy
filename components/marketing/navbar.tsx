import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { MarketingMobileNav, type MarketingNavLink } from "@/components/marketing/mobile-nav"
import { NavbarShell } from "@/components/marketing/navbar-shell"
import { NavSearch } from "@/components/marketing/nav-search"
import { SchoolsMenu, type SchoolCounts } from "@/components/marketing/schools-menu"
import { getCurrentUser } from "@/lib/auth/actions"
import { fetchBrowseCourses } from "@/lib/actions/student"
import { countProgramsBySchool } from "@/lib/schools"
import { needsSchoolChoice } from "@/lib/start-gate"
import { getStartGateState } from "@/lib/start-gate-state"
import { getSellerStatus } from "@/lib/seller"
import { SELLER_HOME } from "@/lib/marketplace"
import { BRAND } from "@/lib/brand"
import { BrandLockup } from "@/components/shared/brand-lockup"
import { cn } from "@/lib/utils"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
const LOGIN_URL = isLocalDev ? "/login" : "https://worldstreetgold.com/login"
const REGISTER_URL = isLocalDev ? "/register" : "https://worldstreetgold.com/register"

const barLinkClass =
  "inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-sm font-medium xl:px-3 text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"

/**
 * The bar's one gold button: "Join WMA" for guests, "Go to dashboard" once
 * signed in. Below 360px the lockup, the button and the menu need ~300px of a
 * 272px row, so the button yields to the sheet (which carries the same path)
 * rather than pushing the menu off-screen.
 */
const primaryClass =
  "inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-ws-brand px-3.5 text-[13px] font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 max-[359px]:hidden sm:h-10 sm:px-5 sm:text-sm"

export async function Navbar({ showFaculty }: { showFaculty: boolean }) {
  // Server-side auth check: signed-in users get one gold path back into the
  // app; guests get the acquisition pair. "My Learning" is signed-in only —
  // for a guest it would just bounce through the login wall.
  const [user, published] = await Promise.all([getCurrentUser(), fetchBrowseCourses()])
  const isInstructor = user && (user.role === "INSTRUCTOR" || user.role === "ADMIN")
  // An approved marketplace seller's way back to their courses (owner, 2026-10-05).
  const isSeller = Boolean(user && user.role === "USER" && (await getSellerStatus(user.id)) === "approved")
  // A learner the gate would bounce (no paid enrollment — owner meeting
  // 2026-10-03) gets "Choose a program" instead of a dashboard link that loops
  // back to /schools, or "Payment status" while an ESPEE proof of theirs is
  // under review. Fails open like the gate: unreadable state shows the dashboard.
  const gate = user && user.role === "USER" ? await getStartGateState(user.id).catch(() => null) : null
  const gated = Boolean(
    user &&
      gate &&
      needsSchoolChoice({ role: user.role, instructorStatus: user.instructorStatus, pathname: "/dashboard", ...gate })
  )

  // fetchBrowseCourses swallows its errors into []: an empty catalogue shows
  // no counts at all rather than seven "Coming soon"s that may be false.
  const counts: SchoolCounts = published.length > 0 ? countProgramsBySchool(published) : null

  // Below lg every destination lives in the sheet (in journey order, spec
  // §17); "How it works" is a landing anchor, so it lives only there. Cohorts
  // and the two ways to teach follow the corrections brief's menu (§3,
  // 2026-10-28): Academy faculty apply at /teach, anyone sells at /sell.
  const sheetLinks: MarketingNavLink[] = [
    { href: "/academy", label: "The Academy" },
    { href: "/schools", label: "All schools" },
    { href: "/programs", label: "All programs" },
    { href: "/calendar", label: "Cohorts" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/new-economy", label: "New Economy — free" },
    ...(showFaculty ? [{ href: "/faculty", label: "Faculty" }] : []),
    { href: "/#how-it-works", label: "How it works" },
    { href: "/teach", label: "Become an Instructor" },
    { href: "/sell", label: "Sell on the marketplace" },
    ...(user && !gated ? [{ href: "/dashboard", label: "My Learning" }] : []),
    ...(isInstructor ? [{ href: "/instructor", label: "Instructor Dashboard" }] : []),
    ...(isSeller ? [{ href: SELLER_HOME, label: "Creator area" }] : []),
  ]
  const sheetActions: MarketingNavLink[] = user
    ? []
    : [
        { href: LOGIN_URL, label: "Sign in", external: true },
        { href: REGISTER_URL, label: "Join WMA", external: true },
      ]

  return (
    // Marketplace header: lockup · Explore schools · search · links · theme ·
    // Sign in · the gold CTA. A solid stone bar — see NavbarShell.
    <NavbarShell>
      {/* Unified ecosystem lockup (05-screens): gold wsa-mark 26px +
          "WorldStreet" Manrope SemiBold 15 + gold app eyebrow. */}
      <Link href="/" className="mr-auto flex shrink-0 items-center gap-2 md:mr-1">
        <BrandLockup alt={BRAND.name} />
      </Link>

      <SchoolsMenu counts={counts} className="hidden md:inline-flex" />
      <NavSearch className="hidden min-w-0 max-w-md flex-1 md:block" />

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:ml-auto">
        {/* Text links from lg: The Academy, Programs and the Marketplace (the
            Academy's two halves, owner 2026-10-03). Measured at 1024: the
            links take px-2 until xl (px-3 after) so the three fit on one
            line with the search still ~90px wide, no wrap and no overflow;
            with Faculty too the search would vanish, so Faculty — and a
            signed-in user's two extra links — wait for xl (Faculty for 2xl
            beside both of them). Below lg they are all in the sheet, with
            New Economy. */}
        <nav aria-label="Site" className="hidden items-center lg:flex">
          <Link href="/academy" className={barLinkClass}>
            The Academy
          </Link>
          <Link href="/programs" className={barLinkClass}>
            Programs
          </Link>
          <Link href="/marketplace" className={barLinkClass}>
            Marketplace
          </Link>
          {showFaculty && (
            <Link
              href="/faculty"
              className={cn(barLinkClass, "hidden", isInstructor ? "2xl:inline-flex" : "xl:inline-flex")}
            >
              Faculty
            </Link>
          )}
          {user && !gated && (
            <Link href="/dashboard" className={cn(barLinkClass, "hidden xl:inline-flex")}>
              My Learning
            </Link>
          )}
          {isInstructor && (
            <Link href="/instructor" className={cn(barLinkClass, "hidden xl:inline-flex")}>
              Instructor Dashboard
            </Link>
          )}
          {isSeller && (
            <Link href={SELLER_HOME} className={cn(barLinkClass, "hidden xl:inline-flex")}>
              Creator area
            </Link>
          )}
        </nav>

        <ThemeToggle className="hidden h-10 w-10 border-transparent text-ws-muted hover:bg-ws-chip hover:text-ws-primary lg:flex" />

        {user && gated && gate?.hasOpenProof ? (
          <Link href="/dashboard/checkout/pending" className={primaryClass}>
            <span className="sm:hidden">Payment</span>
            <span className="hidden sm:inline">Payment status</span>
          </Link>
        ) : user && gated ? (
          <Link href="/schools?start=1" className={primaryClass}>
            <span className="sm:hidden">Choose</span>
            <span className="hidden sm:inline">Choose a program</span>
          </Link>
        ) : user ? (
          // Authenticated: one gold path back into the app. The label
          // shortens below sm to keep the bar inside a 360px viewport.
          <Link href="/dashboard" className={primaryClass}>
            <span className="sm:hidden">Dashboard</span>
            <span className="hidden sm:inline">Go to dashboard</span>
          </Link>
        ) : (
          // Not authenticated: the acquisition pair. Sign in joins the sheet
          // below lg so only the primary CTA stays inline.
          <>
            <Button
              variant="ghost"
              className="hidden h-10 rounded-full px-4 text-sm font-medium text-ws-primary hover:bg-ws-chip lg:inline-flex dark:hover:bg-ws-chip"
              render={<a href={LOGIN_URL} />}
            >
              Sign in
            </Button>
            <a href={REGISTER_URL} className={primaryClass}>
              Join {BRAND.shortName}
            </a>
          </>
        )}

        <MarketingMobileNav links={sheetLinks} actions={sheetActions} counts={counts} className="lg:hidden" />
      </div>
    </NavbarShell>
  )
}
