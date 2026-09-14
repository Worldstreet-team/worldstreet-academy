import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { MarketingMobileNav, type MarketingNavLink } from "@/components/marketing/mobile-nav"
import { NavbarShell } from "@/components/marketing/navbar-shell"
import { getCurrentUser } from "@/lib/auth/actions"
import { BRAND } from "@/lib/brand"
import { BrandLockup } from "@/components/shared/brand-lockup"
import { cn } from "@/lib/utils"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
const LOGIN_URL = isLocalDev ? "/login" : "https://worldstreetgold.com/login"
const REGISTER_URL = isLocalDev ? "/register" : "https://worldstreetgold.com/register"

/**
 * Public destinations, in journey order (spec §17). Shared by the md+ link row
 * and the mobile sheet. "Faculty" (spec §10) is listed only when faculty
 * exists, so it never links to an empty page.
 */
function publicLinks(showFaculty: boolean): MarketingNavLink[] {
  return [
    { href: "/schools", label: "Schools" },
    { href: "/programs", label: "Programs" },
    ...(showFaculty ? [{ href: "/faculty", label: "Faculty" }] : []),
    { href: "/#how-it-works", label: "How it works" },
  ]
}

export async function Navbar({ showFaculty }: { showFaculty: boolean }) {
  // Server-side auth check: signed-in users get one gold path back into the
  // app; guests get the acquisition pair. "My Learning" is signed-in only —
  // for a guest it would just bounce through the login wall.
  const user = await getCurrentUser()
  const isInstructor = user && (user.role === "INSTRUCTOR" || user.role === "ADMIN")

  // Same destinations as the md+ link row, plus the secondary auth action —
  // below md those all live in the sheet so the bar fits a 320px viewport.
  const links = publicLinks(showFaculty)
  const mobileLinks: MarketingNavLink[] = [
    ...links,
    ...(user ? [{ href: "/dashboard", label: "My Learning" }] : []),
    ...(isInstructor ? [{ href: "/instructor", label: "Instructor Dashboard" }] : []),
    ...(user ? [] : [{ href: LOGIN_URL, label: "Sign In", external: true }]),
  ]

  return (
    // Floating glass bar: transparent over the hero, condensing into a
    // blurred pill on scroll (NavbarShell owns that state).
    <NavbarShell>
        <div className="flex min-w-0 items-center gap-6 lg:gap-8">
          {/* Unified ecosystem lockup (05-screens): gold wsa-mark 26px +
              "WorldStreet" Poppins SemiBold 15 + gold app eyebrow. */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <BrandLockup alt={BRAND.name} />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary",
                  // Measured: a fourth link overlaps the bar's CTA below lg, and
                  // below xl once "Instructor Dashboard" is in the row too.
                  link.href === "/faculty" && (isInstructor ? "hidden xl:inline-flex" : "hidden lg:inline-flex")
                )}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <Link
                href="/dashboard"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"
              >
                My Learning
              </Link>
            )}
            {isInstructor && (
              <Link
                href="/instructor"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"
              >
                Instructor Dashboard
              </Link>
            )}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <ThemeToggle />
          {user ? (
            // Authenticated: one gold path back into the app. The label
            // shortens below sm — "Go to dashboard" alone is ~150px, which
            // pushes the bar past a 320px viewport.
            <Link
              href="/dashboard"
              className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-ws-brand px-4 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 sm:px-5"
            >
              <span className="sm:hidden">Dashboard</span>
              <span className="hidden sm:inline">Go to dashboard</span>
            </Link>
          ) : (
            // Not authenticated: the acquisition pair. Sign In collapses into
            // the mobile sheet below md so only the primary CTA stays inline.
            <>
              <Button
                variant="ghost"
                size="sm"
                className="hidden rounded-full md:inline-flex"
                render={<a href={LOGIN_URL} />}
              >
                Sign In
              </Button>
              <Button size="sm" className="shrink-0 whitespace-nowrap rounded-full px-4" render={<a href={REGISTER_URL} />}>
                Get Started
              </Button>
            </>
          )}
          <MarketingMobileNav links={mobileLinks} />
        </div>
    </NavbarShell>
  )
}
