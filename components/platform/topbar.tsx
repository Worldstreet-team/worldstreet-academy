"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  DashboardSpeed01Icon,
  Logout01Icon,
  Moon02Icon,
  Search01Icon,
  Settings01Icon,
  Shield01Icon,
  Sun03Icon,
  TeachingIcon,
  UserIcon,
} from "@hugeicons/core-free-icons"

import { SidebarTrigger } from "@/components/ui/sidebar"
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
import { BalanceChip } from "@/components/platform/balance-chip"
import { NotificationBell } from "@/components/shared/notification-bell"
import { useUser } from "@/components/providers/user-provider"
import { LogoutConfirmDialog } from "@/components/shared/logout-confirm-dialog"
import { LanguagePicker } from "@/components/translator/language-picker"
import { cn } from "@/lib/utils"

/* ── Path → breadcrumb label map ────────────────────────── */
const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  courses: "Courses",
  "my-courses": "My programs",
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

/** One 40px round target for every icon control in the bar (44px hit area on touch). */
const ICON_TARGET =
  "ws-touch-target inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50"

const subscribeNever = () => () => {}

/** ⌘K on Apple devices, Ctrl K elsewhere. The server renders ⌘K; the client corrects after hydration. */
function useIsApple() {
  return React.useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad/i.test(navigator.platform),
    () => true,
  )
}

/** Theme toggle drawn in the bar's own icon set. Icons swap by CSS, so there is no hydration flash. */
function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      title="Toggle theme"
      className={cn(ICON_TARGET, "hidden sm:inline-flex")}
    >
      <HugeiconsIcon icon={Sun03Icon} className="size-[18px] dark:hidden" />
      <HugeiconsIcon icon={Moon02Icon} className="hidden size-[18px] dark:block" />
    </button>
  )
}

type TopbarProps = {
  title?: string
  /** "platform" = student portal, "instructor" = instructor portal, "admin" = admin console */
  variant?: "platform" | "instructor" | "admin"
  /** Override breadcrumb labels for specific path segments (e.g., { "courseId": "Course Title" }) */
  breadcrumbOverrides?: Record<string, string>
}

/**
 * The top bar — the hub navbar's grammar on solid chrome: page-colour fill
 * and a hairline bottom (sticky chrome is never glass, design-system 06).
 * Location on the left, the ⌘K search pill in the middle, a row of 40px
 * round targets on the right.
 */
export function Topbar({ title, variant = "platform", breadcrumbOverrides }: TopbarProps) {
  const pathname = usePathname()
  const crumbs = buildCrumbs(pathname, breadcrumbOverrides)
  const user = useUser()
  const userInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
  const isInstructor = user.role === "INSTRUCTOR" || user.role === "ADMIN"
  const [logoutOpen, setLogoutOpen] = React.useState(false)
  const isApple = useIsApple()

  // Shared cmd+k trigger
  const triggerSearch = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      {/* Logout confirm dialog — rendered outside dropdown so it survives dropdown close */}
      <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />

      <div className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4 md:h-16 md:gap-3 md:px-6 lg:px-8">
        {/* Left cluster — rail trigger + location */}
        <div className="flex min-w-0 items-center gap-1.5">
          {/* The student rail carries its own toggle in its header, so the bar
              only needs one on mobile, where the rail is a sheet. The
              instructor and admin rails have no toggle of their own. */}
          <SidebarTrigger
            className={cn(
              "-ml-1 size-10 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-[18px]!",
              variant === "platform" && "md:hidden",
            )}
          />

          {/* Breadcrumbs — tablet and up */}
          {crumbs.length > 1 ? (
            <Breadcrumb className="hidden min-w-0 overflow-hidden md:flex">
              <BreadcrumbList className="flex-nowrap gap-1">
                {crumbs.map((crumb, i) => {
                  const isLast = i === crumbs.length - 1
                  return (
                    <React.Fragment key={crumb.href}>
                      <BreadcrumbItem className="whitespace-nowrap">
                        {!isLast ? (
                          <BreadcrumbLink
                            render={<Link href={crumb.href} />}
                            className="text-[13px] text-muted-foreground transition-colors duration-[var(--ws-motion-fast)] hover:text-foreground"
                          >
                            {crumb.label}
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage className="text-[13px] font-medium text-foreground">{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                      {!isLast && (
                        <BreadcrumbSeparator className="text-muted-foreground/60 [&>svg]:size-3">
                          <HugeiconsIcon icon={ArrowRight01Icon} />
                        </BreadcrumbSeparator>
                      )}
                    </React.Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          ) : (
            <span className="hidden truncate text-[13px] font-medium text-foreground md:block">
              {title ?? "Dashboard"}
            </span>
          )}

          {/* Mobile: page title only */}
          <span className="truncate text-sm font-semibold text-foreground md:hidden">
            {title ?? crumbs[crumbs.length - 1]?.label ?? "Dashboard"}
          </span>
        </div>

        {/* Center — the search pill on the sunken step. A button in a field's
            clothing: it opens the ⌘K palette. */}
        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
          <button
            type="button"
            onClick={triggerSearch}
            className="group flex h-10 w-full max-w-md items-center gap-2.5 rounded-full bg-surface-sunken pl-4 pr-2 text-left outline-none ring-1 ring-border/70 transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-[13px] text-muted-foreground transition-colors duration-[var(--ws-motion-fast)] group-hover:text-foreground">
              {variant === "admin" ? "Search…" : "Search courses, instructors…"}
            </span>
            <kbd className="pointer-events-none hidden shrink-0 items-center rounded-md bg-background px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground ring-1 ring-border lg:inline-flex">
              {isApple ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>
        </div>

        {/* Right actions — a consistent row of 40px round targets */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 md:gap-1">
          {/* Mobile search */}
          <button type="button" onClick={triggerSearch} aria-label="Search" className={cn(ICON_TARGET, "md:hidden")}>
            <HugeiconsIcon icon={Search01Icon} className="size-[18px]" />
          </button>

          {/* Admin console: no wallet balance or translation — admins aren't
              shopping or reading translated course content in here. */}
          {variant !== "admin" && <BalanceChip />}

          <ThemeButton />

          {variant !== "admin" && (
            <LanguagePicker defaultLanguage={user.preferredLanguage}>
              {({ currentLanguage, isTranslating }) => (
                <button
                  type="button"
                  aria-label={`Change language (${currentLanguage.name})`}
                  title={currentLanguage.name}
                  className={ICON_TARGET}
                  disabled={isTranslating}
                >
                  {isTranslating ? (
                    <span
                      aria-hidden
                      className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
                    />
                  ) : (
                    // The current language's ISO code, not a globe or a flag
                    // emoji (the DS bans emoji as icons). notranslate keeps
                    // Google Translate from rewriting the code itself.
                    <span className="text-[11px] font-semibold uppercase leading-none tracking-wide notranslate" translate="no">
                      {currentLanguage.code}
                    </span>
                  )}
                </button>
              )}
            </LanguagePicker>
          )}

          <NotificationBell />

          <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />

          {/* Account menu — 32px avatar inside a 40px target */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="ws-touch-target flex size-10 shrink-0 items-center justify-center rounded-full outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Avatar className="size-8 ring-1 ring-border">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                <AvatarFallback className="bg-accent text-[10px] font-semibold text-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-foreground">{user.firstName} {user.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {variant === "platform" && isInstructor && (
                <>
                  <DropdownMenuItem render={<Link href="/instructor" />}>
                    <HugeiconsIcon icon={TeachingIcon} />
                    Instructor Portal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {variant !== "admin" && user.role === "ADMIN" && (
                <>
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    <HugeiconsIcon icon={Shield01Icon} />
                    Admin Console
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {(variant === "instructor" || variant === "admin") && (
                <>
                  <DropdownMenuItem render={<Link href="/dashboard" />}>
                    <HugeiconsIcon icon={DashboardSpeed01Icon} />
                    Student Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem render={<Link href={variant === "instructor" ? "/instructor/settings" : "/dashboard/profile"} />}>
                <HugeiconsIcon icon={UserIcon} />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={variant === "instructor" ? "/instructor/settings" : "/dashboard/settings"} />}>
                <HugeiconsIcon icon={Settings01Icon} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                render={<button type="button" className="w-full" onClick={() => setLogoutOpen(true)} />}
              >
                <HugeiconsIcon icon={Logout01Icon} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
