"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  BookOpen,
  ChartLine,
  ChevronDown,
  House,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Plus,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useUser } from "@/components/providers/user-provider"
import { LogoutConfirmDialog } from "@/components/shared/logout-confirm-dialog"
import { useUnreadCount } from "@/lib/hooks/use-unread-count"
import { useOngoingCall } from "@/components/providers/call-provider"
import { useSidebarActivity } from "@/lib/hooks/use-sidebar-activity"

/**
 * Instructor sidebar — same 260px rail recipe as the student AppSidebar
 * (components/platform/app-sidebar.tsx): 40px rows, 20px Lucide glyphs,
 * active row a `bg/chip` pill with a gold icon. The four cross-app
 * WorldStreet links collapse behind one disclosure so they stop competing
 * with teaching navigation.
 */

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
}

const teachItems: NavItem[] = [
  {
    title: "Overview",
    href: "/instructor",
    icon: House,
    match: (p) => p === "/instructor",
  },
  {
    title: "Profile",
    href: "/instructor/profile",
    icon: User,
    match: (p) => p === "/instructor/profile",
  },
  {
    title: "My Courses",
    href: "/instructor/courses",
    icon: BookOpen,
    match: (p) =>
      p === "/instructor/courses" ||
      (p.startsWith("/instructor/courses/") && !p.endsWith("/new")),
  },
  {
    title: "Add Course",
    href: "/instructor/courses/new",
    icon: Plus,
    match: (p) => p === "/instructor/courses/new",
  },
  {
    title: "Certificates",
    href: "/instructor/certificates",
    icon: Trophy,
    match: (p) => p.startsWith("/instructor/certificates"),
  },
  {
    title: "Analytics",
    href: "/instructor/analytics",
    icon: ChartLine,
    match: (p) => p === "/instructor/analytics",
  },
]

const connectItems: NavItem[] = [
  {
    title: "Messages",
    href: "/instructor/messages",
    icon: MessageCircle,
    match: (p) => p === "/instructor/messages",
  },
  {
    title: "Meetings",
    href: "/instructor/meetings",
    icon: Users,
    match: (p) => p.startsWith("/instructor/meetings"),
  },
]

const worldstreetApps = [
  { title: "Crypto Dashboard", href: "https://dashboard.worldstreetgold.com" },
  { title: "Shop", href: "https://shop.worldstreetgold.com" },
  { title: "Xtreme Live", href: "https://xtreme.worldstreetgold.com" },
  { title: "Social Platform", href: "https://social.worldstreetgold.com" },
]

function isActive(item: NavItem, pathname: string) {
  return item.match ? item.match(pathname) : pathname === item.href
}

/** Count/state pill on the right of a nav row. */
function NavBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: "neutral" | "brand" | "live"
}) {
  const tones = {
    neutral: "bg-ws-chip text-ws-muted",
    brand: "bg-ws-brand text-ws-brand-on",
    live: "bg-ws-success/15 text-ws-success",
  }
  return (
    <span
      className={`ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function NavRow({
  item,
  active,
  badge,
}: {
  item: NavItem
  active: boolean
  badge?: React.ReactNode
}) {
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.href} />}
        isActive={active}
        /* `!` overrides are deliberate: SidebarMenuButton's base cva sets
           `h-8` and `[&_svg]:size-4`; the system wants 40px hit targets and
           20px rail icons. */
        className="!h-10 gap-3 rounded-full px-3 text-[15px] font-medium transition-colors duration-[var(--ws-motion-fast)] data-[active=true]:bg-ws-chip data-[active=true]:font-semibold [&_svg]:!size-5"
      >
        <Icon
          size={20}
          strokeWidth={2}
          className={active ? "text-ws-gold" : "text-ws-muted"}
        />
        <span className="truncate">{item.title}</span>
        {badge}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function InstructorSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useUser()
  const unreadCount = useUnreadCount()
  const hasOngoingCall = useOngoingCall()
  const { activeMeetings, invites } = useSidebarActivity()
  const [appsOpen, setAppsOpen] = React.useState(false)

  const userInitials =
    `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"

  const liveCount = activeMeetings.length + invites.length

  // Prefetch all navigation routes on mount for faster transitions
  React.useEffect(() => {
    const routes = [
      ...teachItems.map((i) => i.href),
      ...connectItems.map((i) => i.href),
      "/dashboard",
    ]
    routes.forEach((r) => router.prefetch(r))
  }, [router])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Brand mark matches the student sidebar: logo → public landing. */}
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" aria-label="WorldStreet Academy home" />}
              className="rounded-md transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip"
            >
              {/* Unified ecosystem lockup (05-screens): gold wsa-mark 26px +
                  "WorldStreet" Poppins SemiBold 15 + gold app eyebrow. */}
              <Image
                src="/brand/wsa-mark.png"
                alt=""
                width={26}
                height={26}
                className="h-[26px] w-[26px] shrink-0 object-contain"
              />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-display text-[15px] font-semibold">WorldStreet</span>
                <span className="truncate font-sans text-[10px] font-semibold uppercase tracking-[2px] text-ws-gold">Academy</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {teachItems.map((item) => (
                <NavRow key={item.title} item={item} active={isActive(item, pathname)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {connectItems.map((item) => (
                <NavRow
                  key={item.title}
                  item={item}
                  active={isActive(item, pathname)}
                  badge={
                    item.title === "Messages" ? (
                      hasOngoingCall ? (
                        <NavBadge tone="live">On call</NavBadge>
                      ) : unreadCount > 0 ? (
                        <NavBadge tone="brand">{unreadCount > 99 ? "99+" : unreadCount}</NavBadge>
                      ) : undefined
                    ) : item.title === "Meetings" && liveCount > 0 ? (
                      <NavBadge tone="live">{liveCount} live</NavBadge>
                    ) : undefined
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavRow
                item={{
                  title: "Student Dashboard",
                  href: "/dashboard",
                  icon: LayoutDashboard,
                }}
                active={false}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Cross-app links, collapsed behind one disclosure — a different
            product surface that shouldn't take four rows from teaching nav. */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden mt-auto">
          <SidebarGroupContent>
            <button
              type="button"
              onClick={() => setAppsOpen((v) => !v)}
              aria-expanded={appsOpen}
              className="flex h-10 w-full items-center gap-2 rounded-full px-3 text-[13px] font-medium text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"
            >
              <span>WorldStreet apps</span>
              <ChevronDown
                size={14}
                strokeWidth={2}
                className={`ml-auto transition-transform duration-[var(--ws-motion-base)] ${appsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {appsOpen && (
              <SidebarMenu className="mt-1">
                {worldstreetApps.map((app) => (
                  <SidebarMenuItem key={app.title}>
                    <SidebarMenuButton
                      render={<a href={app.href} target="_blank" rel="noopener noreferrer" />}
                      className="!h-10 rounded-full px-3 text-[13px] text-ws-muted"
                    >
                      <span className="truncate">{app.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <Link
                href="/instructor/profile"
                className="flex min-w-0 items-center gap-2 rounded-full transition-opacity hover:opacity-80"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                  <AvatarFallback className="bg-ws-chip text-xs text-ws-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-xs font-medium text-ws-primary">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="truncate text-[10px] text-ws-subtle">{user.email}</span>
                </div>
              </Link>
              <div className="flex shrink-0 items-center">
                <LogoutConfirmDialog>
                  {(openLogout) => (
                    <button
                      type="button"
                      onClick={openLogout}
                      aria-label="Log out"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-ws-muted transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip hover:text-ws-primary"
                    >
                      <LogOut size={16} strokeWidth={2} />
                    </button>
                  )}
                </LogoutConfirmDialog>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
