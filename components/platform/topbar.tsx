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
import { Search } from "lucide-react"
import { BalanceChip } from "@/components/platform/balance-chip"
import { NotificationBell } from "@/components/shared/notification-bell"
import { useUser } from "@/components/providers/user-provider"
import { LogoutConfirmDialog } from "@/components/shared/logout-confirm-dialog"
import { LanguagePicker } from "@/components/translator/language-picker"
import { GaugeIcon, GraduationCapIcon, LogOutIcon, SettingsIcon, UserIcon } from "lucide-react"

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
  admin: "Admin",
  applications: "Applications",
  users: "Users",
  payments: "Payments",
  reviews: "Reviews",
  "become-instructor": "Become an Instructor",
  wallet: "Wallet",
  deposit: "Deposit",
  withdraw: "Withdraw",
  exam: "Exam",
  exams: "Exams",
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
  /** "platform" = student portal, "instructor" = instructor portal, "admin" = admin console */
  variant?: "platform" | "instructor" | "admin"
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
    <header className="sticky top-0 z-40 bg-ws-surface border-b border-ws-hairline">
      {/* Logout confirm dialog — rendered outside dropdown so it survives dropdown close */}
      <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />

      {/* 64px solid bar, 32px side padding — the design system's TopNav geometry
          (04-components). Solid bg/surface, hairline bottom — no blur/opacity. */}
      <div className="flex h-16 shrink-0 items-center gap-2 px-4 sm:px-8">
        {/* Left cluster — rail trigger + location */}
        <div className="flex min-w-0 items-center gap-2">
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
                          <BreadcrumbLink
                            render={<Link href={crumb.href} />}
                            className="text-[13px] text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:text-ws-primary"
                          >
                            {crumb.label}
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage className="text-[13px] font-medium text-ws-primary">{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator className="[&>svg]:w-3 [&>svg]:h-3" />}
                    </React.Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          ) : (
            <span className="hidden sm:block text-[13px] font-medium text-ws-primary truncate">
              {title ?? "Dashboard"}
            </span>
          )}

          {/* Mobile: page title only */}
          <span className="sm:hidden text-sm font-medium text-ws-primary truncate">
            {title ?? crumbs[crumbs.length - 1]?.label ?? "Dashboard"}
          </span>
        </div>

        {/* Center — SearchField spec (04-components): pill, height 40, bg/chip
            fill, 16px glyph, placeholder Regular 14 text/subtle. A button in
            field's clothing: it opens the ⌘K palette. flex-1 + justify-center
            keeps it anchored to the middle of the bar; max-w-xl stops it from
            going full-bleed on wide screens. */}
        <div className="hidden flex-1 justify-center px-4 sm:flex">
          <button
            type="button"
            onClick={triggerSearch}
            className="group flex h-10 w-full max-w-xl items-center gap-2.5 rounded-full bg-ws-chip px-4 text-left transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ws-brand"
          >
            <Search
              size={16}
              strokeWidth={2}
              className="shrink-0 text-ws-subtle transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-muted"
            />
            <span className="flex-1 truncate text-sm text-ws-subtle transition-colors duration-[var(--ws-motion-fast)] group-hover:text-ws-primary">
              {variant === "admin" ? "Search…" : "Search courses, instructors…"}
            </span>
            <kbd className="pointer-events-none rounded-xs bg-ws-raised px-1.5 py-0.5 tabular-nums text-[10px] font-medium text-ws-subtle transition-colors duration-[var(--ws-motion-fast)] group-hover:bg-ws-chip">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right actions — a consistent row of 40px round targets */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          {/* Mobile search — icon-only, same 40px ghost treatment */}
          <button
            type="button"
            onClick={triggerSearch}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary sm:hidden"
            aria-label="Search"
          >
            <Search size={18} strokeWidth={2} />
          </button>

          {/* Admin console: no wallet balance or translation — admins aren't
              shopping or reading translated course content in here. */}
          {variant !== "admin" && <BalanceChip balance={user.walletBalance} />}

          {/* Theme toggle — desktop only */}
          <div className="hidden sm:flex">
            <ThemeToggle className="h-10 w-10 border-0 text-ws-muted duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary" />
          </div>

          {/* Language picker */}
          {variant !== "admin" && (
            <LanguagePicker defaultLanguage={user.preferredLanguage}>
              {({ currentLanguage, isTranslating }) => (
                <button
                  type="button"
                  aria-label="Change language"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary disabled:pointer-events-none disabled:opacity-50"
                  disabled={isTranslating}
                >
                  {isTranslating ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
                  ) : (
                    // ISO code, not a flag emoji — the DS bans emoji as icons.
                    <span className="text-[10px] font-semibold uppercase tracking-wide notranslate" translate="no">{currentLanguage.code}</span>
                  )}
                </button>
              )}
            </LanguagePicker>
          )}

          {/* Notifications */}
          <NotificationBell />

          {/* Separator before avatar — visual breathing room */}
          <Separator orientation="vertical" className="h-4! mx-1 hidden sm:block" />

          {/* User profile dropdown — 32px avatar inside a 40px hover target */}
          <DropdownMenu>
            <DropdownMenuTrigger className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ws-brand">
              <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-ws-hairline transition-all duration-[var(--ws-motion-fast)] group-hover:ring-2 group-hover:ring-ws-brand">
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
                    <GraduationCapIcon  size={16} />
                    Instructor Portal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {variant !== "admin" && user.role === "ADMIN" && (
                <>
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    <SettingsIcon  size={16} />
                    Admin Console
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {(variant === "instructor" || variant === "admin") && (
                <>
                  <DropdownMenuItem render={<Link href="/dashboard" />}>
                    <GaugeIcon  size={16} />
                    Student Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem render={<Link href={variant === "instructor" ? "/instructor/settings" : "/dashboard/profile"} />}>
                <UserIcon  size={16} />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={variant === "instructor" ? "/instructor/settings" : "/dashboard/settings"} />}>
                <SettingsIcon  size={16} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                render={<button type="button" className="w-full" onClick={() => setLogoutOpen(true)} />}
              >
                <LogOutIcon  size={16} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
