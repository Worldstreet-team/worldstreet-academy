"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTransition } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon, Settings01Icon, Logout01Icon, Search01Icon, CommandIcon, TeachingIcon, DashboardSpeed01Icon } from "@hugeicons/core-free-icons"
import { NotificationBell } from "@/components/shared/notification-bell"
import { useUser } from "@/components/providers/user-provider"
import { useClerk } from "@clerk/nextjs"

/* ── Path → breadcrumb label map ────────────────────────── */
const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  courses: "Courses",
  "my-courses": "My Courses",
  bookmarks: "Bookmarks",
  profile: "Profile",
  settings: "Settings",
  help: "Help",
  instructor: "Instructor",
  analytics: "Analytics",
  new: "New Course",
  edit: "Edit",
  lessons: "Lessons",
  learn: "Learn",
  live: "Live Session",
}

function buildCrumbs(pathname: string, overrides?: Record<string, string>) {
  const segments = pathname.split("/").filter(Boolean)
  const crumbs: { label: string; href: string }[] = []

  let href = ""
  for (const seg of segments) {
    href += `/${seg}`
    // Check overrides first, then labelMap, then format the segment
    const label = overrides?.[seg] ?? labelMap[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    crumbs.push({ label, href })
  }
  return crumbs
}

type TopbarProps = {
  title?: string
  /** "platform" = student portal, "instructor" = instructor portal */
  variant?: "platform" | "instructor"
  /** Override breadcrumb labels for specific path segments (e.g., { "courseId": "Course Title" }) */
  breadcrumbOverrides?: Record<string, string>
}

export function Topbar({ title, variant = "platform", breadcrumbOverrides }: TopbarProps) {
  const pathname = usePathname()
  const crumbs = buildCrumbs(pathname, breadcrumbOverrides)
  const user = useUser()
  const { signOut } = useClerk()
  const [isPending, startTransition] = useTransition()

  const userInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
  const isInstructor = user.role === "INSTRUCTOR" || user.role === "ADMIN"

  function handleLogout() {
    startTransition(async () => {
      await signOut()
      window.location.href = "https://www.worldstreetgold.com/login"
    })
  }

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
      {/* Main bar */}
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 !h-4" />
        <span className="font-semibold text-sm truncate">
          {title ?? "Dashboard"}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {/* Mobile search icon — triggers cmd+k drawer */}
          <button
            type="button"
            onClick={() => {
              const event = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              })
              document.dispatchEvent(event)
            }}
            className="sm:hidden flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Search"
          >
            <HugeiconsIcon icon={Search01Icon} size={16} />
          </button>

          {/* Cmd+K search trigger — desktop */}
          <button
            type="button"
            onClick={() => {
              const event = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              })
              document.dispatchEvent(event)
            }}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground rounded-lg border bg-muted/40 px-2.5 py-1.5 hover:bg-muted transition-colors"
          >
            <HugeiconsIcon icon={Search01Icon} size={14} />
            <span>Search…</span>
            <kbd className="pointer-events-none inline-flex items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <HugeiconsIcon icon={CommandIcon} size={10} />K
            </kbd>
          </button>

          <ThemeToggle />

          {/* User profile dropdown — always visible, especially useful on mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Avatar className="h-8 w-8 cursor-pointer">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {variant === "platform" && isInstructor && (
                <>
                  <DropdownMenuItem render={<Link href="/instructor" />}>
                    <HugeiconsIcon icon={TeachingIcon} size={16} />
                    Instructor Portal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {variant === "instructor" && (
                <>
                  <DropdownMenuItem render={<Link href="/dashboard" />}>
                    <HugeiconsIcon icon={DashboardSpeed01Icon} size={16} />
                    Student Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem render={<Link href={variant === "instructor" ? "/instructor/settings" : "/dashboard/profile"} />}>
                <HugeiconsIcon icon={UserIcon} size={16} />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={variant === "instructor" ? "/instructor/settings" : "/dashboard/settings"} />}>
                <HugeiconsIcon icon={Settings01Icon} size={16} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                variant="destructive" 
                render={<button type="button" className="w-full" onClick={handleLogout} disabled={isPending} />}
              >
                <HugeiconsIcon icon={Logout01Icon} size={16} />
                {isPending ? "Logging out..." : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Breadcrumbs bar — scrollable */}
      {crumbs.length > 1 && (
        <>
          <Separator />
          <div className="flex h-9 items-center px-4 overflow-x-auto scrollbar-none">
            <Breadcrumb>
              <BreadcrumbList className="flex-nowrap">
                {crumbs.map((crumb, i) => {
                  const isLast = i === crumbs.length - 1
                  return (
                    <React.Fragment key={crumb.href}>
                      <BreadcrumbItem className="whitespace-nowrap">
                        {!isLast ? (
                          <BreadcrumbLink render={<Link href={crumb.href} />}>
                            {crumb.label}
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator />}
                    </React.Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </>
      )}
    </header>
  )
}
