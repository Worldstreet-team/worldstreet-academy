"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  Bookmark02Icon,
  Brain01Icon,
  Certificate01Icon,
  ChartUpIcon,
  DashboardSquare01Icon,
  DollarCircleIcon,
  EyeIcon,
  GameController01Icon,
  HelpCircleIcon,
  LinkSquare02Icon,
  Logout01Icon,
  MentoringIcon,
  Message01Icon,
  Search01Icon,
  Store01Icon,
  Task01Icon,
  TeachingIcon,
  UserGroup02Icon,
  UserGroupIcon,
  Video01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUser } from "@/components/providers/user-provider"
import { LogoutConfirmDialog } from "@/components/shared/logout-confirm-dialog"
import { useUnreadCount } from "@/lib/hooks/use-unread-count"
import { useOngoingCall } from "@/components/providers/call-provider"
import { useSidebarActivity } from "@/lib/hooks/use-sidebar-activity"
import { useEnrollments } from "@/lib/hooks/queries"
import { enrollmentHref, grantsAccess, isMentorEnrollment, pickResume } from "@/lib/dashboard-home"
import { BRAND } from "@/lib/brand"
import { BrandLockup } from "@/components/shared/brand-lockup"
import { cn } from "@/lib/utils"

/**
 * Student rail — the hub's floating rail grammar
 * (dashboard-revamp/components/app-sidebar.tsx), ported without its glass:
 * a solid `sidebar` (sunken-step) surface inset from the viewport, 22px
 * corners, hairline ring. Rows are h-9 with a 28px icon chip; the active row
 * is a neutral fill with a gold edge tick and a gold icon — never a gold fill.
 * Sections fold with a CSS height transition (Base UI Collapsible), and
 * nothing here animates on its own.
 *
 * Ordered by how often a learner needs each destination: resume → learn →
 * talk → account → the rest of WorldStreet.
 */

type Icon = typeof DashboardSquare01Icon

type NavItem = {
  title: string
  href: string
  icon: Icon
  match?: (pathname: string) => boolean
}

/** Primary loop — the reasons a learner opens the Academy at all. */
const learnItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: DashboardSquare01Icon, match: (p) => p === "/dashboard" },
  {
    title: "My programs",
    href: "/dashboard/my-courses",
    icon: BookOpen01Icon,
    match: (p) =>
      p === "/dashboard/my-courses" ||
      (p.startsWith("/dashboard/courses/") && p.includes("/learn")),
  },
  {
    title: "Programs",
    href: "/dashboard/courses",
    icon: Search01Icon,
    match: (p) => p === "/dashboard/courses",
  },
  {
    title: "Assignments",
    href: "/dashboard/assignments",
    icon: Task01Icon,
    match: (p) => p.startsWith("/dashboard/assignments"),
  },
  {
    title: "Certificates",
    href: "/dashboard/certificates",
    icon: Certificate01Icon,
    match: (p) => p === "/dashboard/certificates" || p.includes("/certificate"),
  },
]

/** Executive-package mentees only (`isMentorEnrollment`). */
const mentorshipItem: NavItem = {
  title: "Mentorship",
  href: "/dashboard/mentorship",
  icon: MentoringIcon,
  match: (p) => p.startsWith("/dashboard/mentorship"),
}

/** Instructors and admins only. */
const teachItem: NavItem = {
  title: "Teach",
  href: "/instructor",
  icon: TeachingIcon,
  match: (p) => p.startsWith("/instructor"),
}

/** Live/social — carries unread and in-progress state. */
const connectItems: NavItem[] = [
  {
    title: "Messages",
    href: "/dashboard/messages",
    icon: Message01Icon,
    match: (p) => p === "/dashboard/messages",
  },
  {
    title: "Meetings",
    href: "/dashboard/meetings",
    icon: UserGroupIcon,
    match: (p) => p.startsWith("/dashboard/meetings"),
  },
]

/** Low-frequency destinations. Reachable, but not competing for attention. */
const accountItems: NavItem[] = [
  { title: "Wallet", href: "/dashboard/wallet", icon: Wallet01Icon, match: (p) => p.startsWith("/dashboard/wallet") },
  {
    title: "Bookmarks",
    href: "/dashboard/bookmarks",
    icon: Bookmark02Icon,
    match: (p) => p === "/dashboard/bookmarks",
  },
  {
    title: "Help",
    href: "/dashboard/help",
    icon: HelpCircleIcon,
    match: (p) => p === "/dashboard/help",
  },
]

type WorldStreetApp = { title: string; description: string; href: string; icon: Icon }

/**
 * Every WorldStreet app except this one. Source: the hub's NAV_GROUPS
 * "Worldstreet" group (dashboard-revamp/components/app-sidebar.tsx) — same
 * hosts, descriptions and icons ("Store" is "Shop" here, the DS cross-app
 * label) — plus the hub itself, which the hub doesn't list. The hub is
 * www.worldstreetgold.com: its README and root layout say so, and
 * dashboard.worldstreetgold.com only redirects to www's login. Vivid AI is a
 * route on the hub, so it is absolute here.
 */
const WORLDSTREET_APPS: readonly WorldStreetApp[] = [
  { title: "Dashboard", description: "Wallet, portfolio and trading", href: "https://www.worldstreetgold.com", icon: DashboardSquare01Icon },
  { title: "Shop", description: "Official merchandise", href: "https://shop.worldstreetgold.com", icon: Store01Icon },
  { title: "Social", description: "Community hub", href: "https://social.worldstreetgold.com", icon: UserGroup02Icon },
  { title: "Xstream", description: "Live streaming", href: "https://xtreme.worldstreetgold.com", icon: Video01Icon },
  { title: "Forex Trading", description: "Currency pairs", href: "https://portal.worldstreetgold.com", icon: DollarCircleIcon },
  { title: "Vivid AI", description: "AI-powered insights", href: "https://www.worldstreetgold.com/vivid", icon: Brain01Icon },
  { title: "Vision", description: "Vision broadcast", href: "https://vision.worldstreetgold.com", icon: EyeIcon },
  { title: "Arcade", description: "Games", href: "https://arcade.worldstreetgold.com", icon: GameController01Icon },
  { title: "Prediction", description: "Prediction markets", href: "https://prediction.worldstreetgold.com", icon: ChartUpIcon },
]

function isActive(item: NavItem, pathname: string) {
  return item.match ? item.match(pathname) : pathname === item.href
}

/**
 * The rail surface. `className` lands on the sidebar container; the inner
 * surface is reached by data-slot. The `!` marks beat the primitive's own
 * floating defaults (rounded-lg, shadow-sm), which tie on specificity.
 * `isolate` lets the crown wash sit at -z-10 above the fill, under the rows.
 */
const RAIL = cn(
  "py-4 pl-4 pr-1",
  "[&_[data-slot=sidebar-inner]]:relative [&_[data-slot=sidebar-inner]]:isolate [&_[data-slot=sidebar-inner]]:overflow-hidden",
  "[&_[data-slot=sidebar-inner]]:rounded-[22px]! [&_[data-slot=sidebar-inner]]:ring-1! [&_[data-slot=sidebar-inner]]:ring-sidebar-border!",
  "[&_[data-slot=sidebar-inner]]:shadow-[0_8px_32px_-12px_rgb(0_0_0/0.28)]!",
)

/** One height, one corner, one icon size for every row in the rail. */
const ROW = "h-9 gap-3 rounded-[10px] px-2.5 text-[13.5px] [&_svg]:size-[18px] focus-visible:ring-inset"

/**
 * Icon mode: the primitive pins buttons to a 32px square with 8px padding.
 * The hub's collapsed row is full-width with the glyph centred instead.
 */
const COLLAPSED_ROW = "group-data-[collapsible=icon]:size-full! group-data-[collapsible=icon]:justify-center"

const TRIGGER =
  "size-9 shrink-0 rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground [&_svg]:size-[18px]!"

type Badge = { label: string; tone: "neutral" | "brand" | "live" }

/** Count/state pill on the right of a row — the hub's badge. */
function NavBadge({ badge }: { badge: Badge }) {
  return (
    <span
      className={cn(
        "ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-bold leading-none tabular-nums",
        badge.tone === "brand" ? "bg-primary/[0.14] text-ws-gold" : "bg-foreground/[0.08] text-muted-foreground",
      )}
    >
      {badge.tone === "live" && <span aria-hidden className="size-1.5 rounded-full bg-credit" />}
      {badge.label}
    </span>
  )
}

function NavRow({
  item,
  active,
  collapsed,
  badge,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  badge?: Badge
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.href} />}
        isActive={active}
        tooltip={item.title}
        className={cn(
          ROW,
          COLLAPSED_ROW,
          "group-data-[collapsible=icon]:p-1!",
          "relative text-foreground/75 transition-colors duration-[var(--ws-motion-fast)]",
          "hover:bg-foreground/[0.04] hover:text-foreground active:bg-foreground/[0.06] active:text-foreground",
          "data-active:bg-foreground/[0.06] data-active:font-medium data-active:text-foreground data-active:shadow-[inset_0_1px_0_0_var(--color-border)]",
        )}
      >
        {/* The one place gold says "you are here": a tick on the rail's edge. */}
        {active && !collapsed && (
          <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <span
          className={cn(
            "relative flex size-7 shrink-0 items-center justify-center rounded-[9px] transition-colors duration-[var(--ws-motion-fast)]",
            active ? "bg-primary/[0.18]" : "bg-foreground/[0.05]",
          )}
        >
          <HugeiconsIcon icon={item.icon} className={active ? "text-primary" : "text-muted-foreground"} />
          {/* Icon mode has no room for the pill; state that needs attention
              (unread, live) keeps a dot on the chip. */}
          {collapsed && badge && badge.tone !== "neutral" && (
            <span
              aria-hidden
              className={cn(
                "absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-sidebar",
                badge.tone === "brand" ? "bg-primary" : "bg-credit",
              )}
            />
          )}
        </span>
        <span className={cn("flex-1 truncate", collapsed && "sr-only")}>{item.title}</span>
        {badge && !collapsed && <NavBadge badge={badge} />}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/** The products rail is a footnote: bare icon, dimmer rows, external glyph. */
function AppRow({ app, collapsed, isMobile }: { app: WorldStreetApp; collapsed: boolean; isMobile: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<a href={app.href} target="_blank" rel="noopener noreferrer" />}
        // Unlike the Academy rows, these explain themselves in the open rail
        // too: the names alone don't say what Vision or Xstream are.
        tooltip={{
          children: collapsed ? `${app.title} · ${app.description}` : app.description,
          hidden: isMobile,
        }}
        className={cn(
          ROW,
          COLLAPSED_ROW,
          "group-data-[collapsible=icon]:p-[9px]!",
          "text-muted-foreground transition-colors duration-[var(--ws-motion-fast)]",
          "hover:bg-foreground/[0.04] hover:text-foreground active:bg-foreground/[0.06] active:text-foreground",
        )}
      >
        <HugeiconsIcon icon={app.icon} className="text-muted-foreground/80" />
        <span className={cn("flex-1 truncate", collapsed && "sr-only")}>{app.title}</span>
        {!collapsed && (
          <HugeiconsIcon icon={LinkSquare02Icon} aria-hidden className="size-3! shrink-0 text-muted-foreground/40" />
        )}
        <span className="sr-only">(opens in a new tab)</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/**
 * A rail section: the hub's SectionLabel eyebrow over rows that fold away.
 * Open by default — every section is short enough to live on screen.
 */
function NavGroup({
  label,
  hasActive,
  collapsed,
  children,
}: {
  label: string
  hasActive: boolean
  collapsed: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(true)

  // A folded section must not hide where you are: it re-opens when one of its
  // rows becomes active. Adjusted during render, so it lands in the same paint.
  const [prevActive, setPrevActive] = React.useState(hasActive)
  if (prevActive !== hasActive) {
    setPrevActive(hasActive)
    if (hasActive) setOpen(true)
  }

  if (collapsed) {
    return (
      <SidebarGroup className="border-t border-sidebar-border px-0 py-1.5 first:border-t-0">
        <SidebarMenu className="gap-0.5">{children}</SidebarMenu>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup className="px-0 py-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-2 rounded-[7px] px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] outline-none transition-colors duration-[var(--ws-motion-fast)] focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            hasActive ? "text-ws-gold" : "text-muted-foreground/70 hover:text-foreground",
          )}
        >
          <span className="flex-1 text-left">{label}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-[var(--ws-motion-base)] motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-[var(--ws-motion-base)] ease-(--ws-ease) data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none">
          <SidebarMenu className="gap-0.5">{children}</SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useUser()
  const { state, isMobile } = useSidebar()
  // The mobile sheet always shows the full rail, whatever the desktop cookie says.
  const collapsed = state === "collapsed" && !isMobile
  const unreadCount = useUnreadCount()
  const hasOngoingCall = useOngoingCall()
  const { activeMeetings, invites } = useSidebarActivity()
  const { data: enrollments = [] } = useEnrollments()

  const userInitials =
    `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
  const isInstructor = user.role === "INSTRUCTOR" || user.role === "ADMIN"

  /**
   * Resuming a course is the single most common reason a learner returns. The
   * dashboard's Continue learning pick (`pickResume`) gets a card here too, so
   * the rail and the dashboard always resume the same course.
   */
  const resume = React.useMemo(() => pickResume(enrollments), [enrollments])

  // Only enrollments that still open the player count as "in progress".
  const inProgressCount = enrollments.filter((e) => grantsAccess(e) && e.progress < 100).length
  const liveCount = activeMeetings.length + invites.length
  const hasMentorship = enrollments.some(isMentorEnrollment)

  const learn = [
    ...learnItems,
    ...(hasMentorship ? [mentorshipItem] : []),
    ...(isInstructor ? [teachItem] : []),
  ]

  React.useEffect(() => {
    const routes = [
      ...learnItems.map((i) => i.href),
      ...(hasMentorship ? [mentorshipItem.href] : []),
      ...connectItems.map((i) => i.href),
      ...accountItems.map((i) => i.href),
      isInstructor ? teachItem.href : "/dashboard/become-instructor",
    ]
    routes.forEach((r) => router.prefetch(r))
  }, [router, isInstructor, hasMentorship])

  const badgeFor = (item: NavItem): Badge | undefined => {
    if (item.href === "/dashboard/my-courses" && inProgressCount > 0) {
      return { label: String(inProgressCount), tone: "neutral" }
    }
    if (item.href === "/dashboard/messages") {
      if (hasOngoingCall) return { label: "On call", tone: "live" }
      if (unreadCount > 0) return { label: unreadCount > 99 ? "99+" : String(unreadCount), tone: "brand" }
    }
    if (item.href === "/dashboard/meetings" && liveCount > 0) {
      return { label: `${liveCount} live`, tone: "live" }
    }
    return undefined
  }

  const rows = (items: NavItem[]) =>
    items.map((item) => (
      <NavRow
        key={item.href}
        item={item}
        active={isActive(item, pathname)}
        collapsed={collapsed}
        badge={badgeFor(item)}
      />
    ))

  return (
    <Sidebar variant="floating" collapsible="icon" className={RAIL}>
      {/* Crown wash — a static warm bloom behind the lockup, dark mode only
          (the ambient glow is off on paper, design-system 01). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-56 bg-[radial-gradient(120%_80%_at_10%_0%,var(--color-ws-glow)_0%,transparent_70%)] dark:block"
      />

      {/* Lockup + rail toggle, as on the hub. Collapsed: the mark, and the
          toggle under it. The logo opens the public landing — the shell
          already lives at /dashboard. */}
      <SidebarHeader className="gap-0 px-2.5 pb-2 pt-4">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <Link
            href="/"
            aria-label={`${BRAND.name} home`}
            className={cn(
              "flex min-w-0 flex-1 items-center rounded-[10px] outline-none transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-85 focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              collapsed && "flex-none",
            )}
          >
            {collapsed ? (
              <Image
                src="/brand/wsa-mark.png"
                alt=""
                width={26}
                height={26}
                className="h-[26px] w-[26px] shrink-0 object-contain"
              />
            ) : (
              <BrandLockup truncate />
            )}
          </Link>
          {!collapsed && <SidebarTrigger className={TRIGGER} />}
        </div>
        {collapsed && <SidebarTrigger className={cn(TRIGGER, "mx-auto mt-2")} />}
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2.5 pb-3 pt-1 group-data-[collapsible=icon]:overflow-y-auto">
        {/* Continue learning — the primary job, one click from anywhere. */}
        {resume && !collapsed && (
          <Link
            href={enrollmentHref(resume)}
            className="mb-1 mt-1 block rounded-[20px] border border-border bg-card p-3.5 outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring dark:border-transparent"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Continue learning
            </p>
            <p className="mt-1.5 line-clamp-2 text-[13.5px] font-semibold leading-snug text-foreground">
              {resume.courseTitle}
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(resume.progress, 2)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
              {resume.progress}% complete
            </p>
          </Link>
        )}

        <NavGroup label="Learn" hasActive={learn.some((i) => isActive(i, pathname))} collapsed={collapsed}>
          {rows(learn)}
        </NavGroup>

        <NavGroup label="Connect" hasActive={connectItems.some((i) => isActive(i, pathname))} collapsed={collapsed}>
          {rows(connectItems)}
        </NavGroup>

        <NavGroup label="Account" hasActive={accountItems.some((i) => isActive(i, pathname))} collapsed={collapsed}>
          {rows(accountItems)}
        </NavGroup>

        {/* Teaching is a conversion action, not a destination — a card, not
            another row competing with navigation. */}
        {!isInstructor && !collapsed && (
          <Link
            href="/dashboard/become-instructor"
            className="group/teach my-2 flex items-center gap-3 rounded-[20px] border border-border bg-card p-3.5 outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring dark:border-transparent"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-foreground">Teach on Academy</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                Share what you know and earn from your courses.
              </span>
            </span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-colors duration-[var(--ws-motion-fast)] group-hover/teach:text-foreground"
            />
          </Link>
        )}

        {/* The rest of the ecosystem — every app, each in a new tab. */}
        <NavGroup label="WorldStreet" hasActive={false} collapsed={collapsed}>
          {WORLDSTREET_APPS.map((app) => (
            <AppRow key={app.title} app={app} collapsed={collapsed} isMobile={isMobile} />
          ))}
        </NavGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2.5 py-2.5">
        <div className={cn("flex items-center gap-1", collapsed && "justify-center")}>
          <Link
            href="/dashboard/profile"
            aria-label={collapsed ? "Profile" : undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] p-1.5 outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring",
              collapsed && "flex-none",
            )}
          >
            <Avatar className="size-8 shrink-0 ring-1 ring-border">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback className="bg-accent text-[11px] font-semibold text-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {user.firstName} {user.lastName}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{user.email}</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <LogoutConfirmDialog>
              {(openLogout) => (
                <button
                  type="button"
                  onClick={openLogout}
                  aria-label="Log out"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-[var(--ws-motion-fast)] hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <HugeiconsIcon icon={Logout01Icon} className="size-[18px]" />
                </button>
              )}
            </LogoutConfirmDialog>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
