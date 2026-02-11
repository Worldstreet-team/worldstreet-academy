"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTransition } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Home01Icon,
  BookOpen01Icon,
  Search01Icon,
  HelpCircleIcon,
  UserIcon,
  Logout01Icon,
  Bookmark01Icon,
  Message01Icon,
  TeachingIcon,
  Call02Icon,
  MeetingRoomIcon,
  Globe02Icon,
  BitcoinIcon,
  ShoppingBag01Icon,
  PlayIcon,
  UserMultipleIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons"
import { useUser } from "@/components/providers/user-provider"
import { logoutAction } from "@/lib/auth/actions"
import { useUnreadCount } from "@/lib/hooks/use-unread-count"
import { useOngoingCall } from "@/components/providers/call-provider"
import { useSidebarActivity } from "@/lib/hooks/use-sidebar-activity"

type NavItem = {
  title: string
  href: string
  icon: IconSvgElement
  match?: (pathname: string) => boolean
}

const mainItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home01Icon,
    match: (p) => p === "/dashboard",
  },
  {
    title: "Browse Courses",
    href: "/dashboard/courses",
    icon: Search01Icon,
    match: (p) => p === "/dashboard/courses",
  },
  {
    title: "My Courses",
    href: "/dashboard/my-courses",
    icon: BookOpen01Icon,
    match: (p) => p === "/dashboard/my-courses" || (p.startsWith("/dashboard/courses/") && p.includes("/learn")),
  },
  {
    title: "Bookmarks",
    href: "/dashboard/bookmarks",
    icon: Bookmark01Icon,
    match: (p) => p === "/dashboard/bookmarks",
  },
]

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
    icon: MeetingRoomIcon,
    match: (p) => p.startsWith("/dashboard/meetings"),
  },
]

const accountItems: NavItem[] = [
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: UserIcon,
    match: (p) => p === "/dashboard/profile",
  },
  {
    title: "Help",
    href: "/dashboard/help",
    icon: HelpCircleIcon,
    match: (p) => p === "/dashboard/help",
  },
]

type ExternalNavItem = {
  title: string
  href: string
  icon: IconSvgElement
}

const worldstreetItems: ExternalNavItem[] = [
  {
    title: "Crypto Dashboard",
    href: "https://dashboard.worldstreetgold.com",
    icon: BitcoinIcon,
  },
  {
    title: "Shop",
    href: "https://shop.worldstreetgold.com",
    icon: ShoppingBag01Icon,
  },
  {
    title: "Xtreme Live",
    href: "https://xtreme.worldstreetgold.com",
    icon: PlayIcon,
  },
  {
    title: "Social Platform",
    href: "https://social.worldstreetgold.com",
    icon: UserMultipleIcon,
  },
]

function isActive(item: NavItem, pathname: string) {
  if (item.match) return item.match(pathname)
  return pathname === item.href
}

export function AppSidebar() {
  const pathname = usePathname()
  const user = useUser()
  const [isPending, startTransition] = useTransition()
  const unreadCount = useUnreadCount()
  const hasOngoingCall = useOngoingCall()
  const { activeMeetings, invites, hasActivity } = useSidebarActivity()

  const userInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
  const isInstructor = user.role === "INSTRUCTOR" || user.role === "ADMIN"

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                W
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">WorldStreet</span>
                <span className="truncate text-xs text-muted-foreground">
                  Academy
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Learn</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item, pathname)}
                  >
                    <HugeiconsIcon icon={item.icon} size={18} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hasActivity && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Activity</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {activeMeetings.slice(0, 3).map((m) => (
                    <SidebarMenuItem key={m.id}>
                      <SidebarMenuButton render={<Link href={`/dashboard/meetings?join=${m.id}`} />}>
                        <HugeiconsIcon icon={Video01Icon} size={18} className="text-muted-foreground" />
                        <span className="truncate text-xs">{m.title.length > 18 ? m.title.slice(0, 18) + "..." : m.title}</span>
                        <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {invites.slice(0, 2).map((inv) => (
                    <SidebarMenuItem key={inv.id}>
                      <SidebarMenuButton render={<Link href={`/dashboard/meetings?join=${inv.meetingId}`} />}>
                        <HugeiconsIcon icon={Video01Icon} size={18} className="text-muted-foreground" />
                        <span className="truncate text-xs">{inv.title.length > 18 ? inv.title.slice(0, 18) + "..." : inv.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Connect</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {connectItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item, pathname)}
                  >
                    <HugeiconsIcon icon={item.icon} size={18} />
                    <span>{item.title}</span>
                    {item.title === "Messages" && hasOngoingCall && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/15 px-1.5">
                        <HugeiconsIcon icon={Call02Icon} size={12} className="text-emerald-500" />
                      </span>
                    )}
                    {item.title === "Messages" && !hasOngoingCall && unreadCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item, pathname)}
                  >
                    <HugeiconsIcon icon={item.icon} size={18} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>WorldStreet</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {worldstreetItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={
                      <a href={item.href} target="_blank" rel="noopener noreferrer" />
                    }
                  >
                    <HugeiconsIcon icon={item.icon} size={18} />
                    <span>{item.title}</span>
                    <HugeiconsIcon icon={Globe02Icon} size={12} className="ml-auto text-muted-foreground/40" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          {isInstructor && (
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/instructor" />}>
                <HugeiconsIcon icon={TeachingIcon} size={18} />
                <span>Instructor Portal</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-7 w-7 shrink-0">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-medium text-xs">{user.firstName} {user.lastName}</span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              render={<button type="button" onClick={handleLogout} disabled={isPending} />}
            >
              <HugeiconsIcon icon={Logout01Icon} size={18} />
              <span>{isPending ? "Logging out..." : "Log out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
