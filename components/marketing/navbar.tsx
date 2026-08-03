import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
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

  return (
    // TopNav spec (05-screens): solid surface + hairline, 26px mark,
    // wordmark Poppins SemiBold 15.
    <header className="sticky top-0 z-50 w-full border-b border-ws-hairline bg-ws-surface">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          {/* Unified ecosystem lockup (05-screens): gold wsa-mark 26px +
              "WorldStreet" Poppins SemiBold 15 + gold app eyebrow. */}
          <Link href="/" className="flex items-center gap-2">
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
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            // Authenticated: one gold path back into the app
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-sm bg-ws-brand px-5 font-semibold text-ws-brand-on transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90"
            >
              Go to dashboard
            </Link>
          ) : (
            // Not authenticated: Show sign in buttons
            <>
              <Button variant="ghost" size="sm" render={<a href={LOGIN_URL} />}>
                Sign In
              </Button>
              <Button size="sm" render={<a href={REGISTER_URL} />}>
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
