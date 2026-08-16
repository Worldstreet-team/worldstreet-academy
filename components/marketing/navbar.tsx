import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { MarketingMobileNav, type MarketingNavLink } from "@/components/marketing/mobile-nav"
import { NavbarShell } from "@/components/marketing/navbar-shell"
import { getCurrentUser } from "@/lib/auth/actions"

const isLocalDev = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
const LOGIN_URL = isLocalDev ? "/login" : "https://worldstreetgold.com/login"
const REGISTER_URL = isLocalDev ? "/register" : "https://worldstreetgold.com/register"

export async function Navbar() {
  // Server-side auth check: signed-in users get one gold path back into the
  // app; guests get the acquisition pair. "My Learning" is signed-in only —
  // for a guest it would just bounce through the login wall.
  const user = await getCurrentUser()
  const isInstructor = user && (user.role === "INSTRUCTOR" || user.role === "ADMIN")

  // Same destinations as the md+ link row, plus the secondary auth action —
  // below md those all live in the sheet so the bar fits a 320px viewport.
  const mobileLinks: MarketingNavLink[] = [
    { href: "/courses", label: "Courses" },
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
            <Image
              src="/brand/wsa-mark.png"
              alt="WorldStreet Academy"
              width={26}
              height={26}
              className="h-[26px] w-[26px] object-contain"
            />
            <span className="grid text-left leading-tight">
              <span className="font-display text-[15px] font-semibold tracking-tight">WorldStreet</span>
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[2px] text-ws-gold">Academy</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/courses"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"
            >
              Courses
            </Link>
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
