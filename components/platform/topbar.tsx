"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

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
import { LogoutConfirmDialog } from "@/components/shared/logout-confirm-dialog"
import { LanguagePicker } from "@/components/translator/language-picker"

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
  const userInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
  const isInstructor = user.role === "INSTRUCTOR" || user.role === "ADMIN"
  const [logoutOpen, setLogoutOpen] = useState(false)

  // Shared cmd+k trigger
  const triggerSearch = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    )
  }

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      {/* Logout confirm dialog — rendered outside dropdown so it survives dropdown close */}
      <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />

      {/* Single compact bar */}
      <div className="flex h-12 shrink-0 items-center gap-2 px-3 sm:px-4">
        <SidebarTrigger className="-ml-0.5 shrink-0" />
        <Separator orientation="vertical" className="h-4! mx-1 hidden sm:block" />

        {/* Breadcrumbs — desktop only, replaces the old title + separate breadcrumb bar */}
        {crumbs.length > 1 ? (
          <Breadcrumb className="hidden sm:flex min-w-0">
            <BreadcrumbList className="flex-nowrap gap-1">
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1
                return (
                  <React.Fragment key={crumb.href}>
                    <BreadcrumbItem className="whitespace-nowrap">
                      {!isLast ? (
                        <BreadcrumbLink render={<Link href={crumb.href} />} className="text-xs">
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage className="text-xs font-medium">{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator className="[&>svg]:w-3 [&>svg]:h-3" />}
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <span className="hidden sm:block text-sm font-medium text-foreground/90 truncate">
            {title ?? "Dashboard"}
          </span>
        )}

        {/* Mobile: page title only */}
        <span className="sm:hidden text-sm font-medium text-foreground/90 truncate">
          {title ?? crumbs[crumbs.length - 1]?.label ?? "Dashboard"}
        </span>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Cmd+K search — desktop: pill button, mobile: icon */}
          <button
            type="button"
            onClick={triggerSearch}
            className="sm:hidden flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Search"
          >
            <HugeiconsIcon icon={Search01Icon} size={15} />
          </button>
          <button
            type="button"
            onClick={triggerSearch}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={Search01Icon} size={13} />
            <span className="text-[11px]">Search…</span>
            <kbd className="pointer-events-none inline-flex items-center gap-0.5 rounded border border-border/50 bg-background/80 px-1 font-mono text-[9px] font-medium text-muted-foreground/70">
              <HugeiconsIcon icon={CommandIcon} size={9} />K
            </kbd>
          </button>

          {/* Theme toggle — desktop only */}
          <div className="hidden sm:flex">
            <ThemeToggle />
          </div>

          {/* Language picker */}
          <LanguagePicker defaultLanguage={user.preferredLanguage}>
            {({ currentLanguage, isTranslating }) => (
              <button
                type="button"
                aria-label="Change language"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:pointer-events-none disabled:opacity-50"
                disabled={isTranslating}
              >
                {isTranslating ? (
                  <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
                ) : (
                  <span className="text-sm leading-none notranslate" translate="no">{currentLanguage.flag}</span>
                )}
              </button>
            )}
          </LanguagePicker>

          {/* Separator before avatar — visual breathing room */}
          <Separator orientation="vertical" className="h-4! hidden sm:block" />

          {/* User profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Avatar className="h-7 w-7 cursor-pointer ring-1 ring-border/40 hover:ring-border transition-all">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
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
                render={<button type="button" className="w-full" onClick={() => setLogoutOpen(true)} />}
              >
                <HugeiconsIcon icon={Logout01Icon} size={16} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
