import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getCurrentUser } from "@/lib/auth"

export async function Navbar() {
  // Check if user is authenticated
  const user = await getCurrentUser()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
              W
            </div>
            <span className="text-lg font-bold tracking-tight">
              WorldStreet <span className="text-muted-foreground font-normal">Academy</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/courses"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Courses
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              My Learning
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            // Authenticated: Show avatar linking to dashboard
            <Link href="/dashboard" className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {`${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            // Not authenticated: Show sign in buttons
            <>
              <Button variant="ghost" size="sm" render={<a href="https://worldstreetgold.com/login" />}>
                Sign In
              </Button>
              <Button size="sm" render={<a href="https://worldstreetgold.com/register" />}>
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
