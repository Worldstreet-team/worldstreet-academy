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
  Add01Icon,
  Settings01Icon,
  Analytics01Icon,
  Logout01Icon,
  Message01Icon,
  DashboardSpeed01Icon,
} from "@hugeicons/core-free-icons"
import { useUser } from "@/components/providers/user-provider"
import { logoutAction } from "@/lib/auth/actions"
import { useUnreadCount } from "@/lib/hooks/use-unread-count"

type NavItem = {
  title: string
  href: string
  icon: IconSvgElement
  match?: (pathname: string) => boolean
}

const mainItems: NavItem[] = [
  {
    title: "Overview",
    href: "/instructor",
    icon: Home01Icon,
    match: (p) => p === "/instructor",
  },
  {
    title: "My Courses",
    href: "/instructor/courses",
    icon: BookOpen01Icon,
    match: (p) =>
      p === "/instructor/courses" ||
      (p.startsWith("/instructor/courses/") &&
        !p.endsWith("/new")),
  },
  {
    title: "Add Course",
    href: "/instructor/courses/new",
    icon: Add01Icon,
    match: (p) => p === "/instructor/courses/new",
  },
  {
    title: "Analytics",
    href: "/instructor/analytics",
    icon: Analytics01Icon,
    match: (p) => p === "/instructor/analytics",
  },
  {
    title: "Messages",
    href: "/instructor/messages",
    icon: Message01Icon,
    match: (p) => p === "/instructor/messages",
  },
]

const accountItems: NavItem[] = [
  {
    title: "Settings",
    href: "/instructor/settings",
    icon: Settings01Icon,
    match: (p) => p === "/instructor/settings",
  },
]

function isActive(item: NavItem, pathname: string) {
  if (item.match) return item.match(pathname)
  return pathname === item.href
}

export function InstructorSidebar() {
  const pathname = usePathname()
  const user = useUser()
  const [isPending, startTransition] = useTransition()
  const unreadCount = useUnreadCount()

  const userInitials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()

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
            <SidebarMenuButton size="lg" render={<Link href="/instructor" />}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                W
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">WorldStreet</span>
                <span className="truncate text-xs text-muted-foreground">
                  Instructor Portal
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
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
                    {item.title === "Messages" && unreadCount > 0 && (
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
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/dashboard" />}>
              <HugeiconsIcon icon={DashboardSpeed01Icon} size={18} />
              <span>Student Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
                    instructor
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
