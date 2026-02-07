"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Home01Icon,
  BookOpen01Icon,
  Search01Icon,
  Settings01Icon,
  HelpCircleIcon,
  UserIcon,
  Logout01Icon,
  Bookmark01Icon,
} from "@hugeicons/core-free-icons"

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
    title: "Favorites",
    href: "/dashboard/favorites",
    icon: Bookmark01Icon,
    match: (p) => p === "/dashboard/favorites",
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
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings01Icon,
    match: (p) => p === "/dashboard/settings",
  },
  {
    title: "Help",
    href: "/dashboard/help",
    icon: HelpCircleIcon,
    match: (p) => p === "/dashboard/help",
  },
]

function isActive(item: NavItem, pathname: string) {
  if (item.match) return item.match(pathname)
  return pathname === item.href
}

export function AppSidebar() {
  const pathname = usePathname()

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
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    U
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-medium text-xs">User</span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    user@worldstreet.com
                  </span>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<button type="button" />}>
              <HugeiconsIcon icon={Logout01Icon} size={18} />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
