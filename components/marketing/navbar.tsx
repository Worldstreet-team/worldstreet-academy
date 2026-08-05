import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { MarketingMobileNav, type MarketingNavLink } from "@/components/marketing/mobile-nav"
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
    // TopNav spec (05-screens): solid surface + hairline, 26px mark,
    // wordmark Poppins SemiBold 15.
    <header className="sticky top-0 z-50 w-full border-b border-ws-hairline bg-ws-surface">
      <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-8">
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
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/courses"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Courses
            </Link>
            {user && (
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                My Learning
              </Link>
            )}
            {isInstructor && (
              <Link
                href="/instructor"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
              className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-sm bg-ws-brand px-3 text-sm font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90 sm:px-5 sm:text-base"
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
                className="hidden md:inline-flex"
                render={<a href={LOGIN_URL} />}
              >
                Sign In
              </Button>
              <Button size="sm" className="shrink-0 whitespace-nowrap" render={<a href={REGISTER_URL} />}>
                Get Started
              </Button>
            </>
          )}
          <MarketingMobileNav links={mobileLinks} />
        </div>
      </div>
    </header>
  )
}
