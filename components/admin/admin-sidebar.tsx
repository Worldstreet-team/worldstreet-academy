"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
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
  Logout01Icon,
  DashboardSpeed01Icon,
  TeachingIcon,
  UserMultipleIcon,
  DollarCircleIcon,
  StarIcon,
  Certificate01Icon,
} from "@hugeicons/core-free-icons"
import { useUser } from "@/components/providers/user-provider"
import { LogoutConfirmDialog } from "@/components/shared/logout-confirm-dialog"

type NavItem = {
  title: string
  href: string
  icon: IconSvgElement
  match?: (pathname: string) => boolean
}

const manageItems: NavItem[] = [
  {
    title: "Overview",
    href: "/admin",
    icon: Home01Icon,
    match: (p) => p === "/admin",
  },
  {
    title: "Applications",
    href: "/admin/applications",
    icon: TeachingIcon,
    match: (p) => p.startsWith("/admin/applications"),
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: UserMultipleIcon,
    match: (p) => p.startsWith("/admin/users"),
  },
  {
    title: "Payments",
    href: "/admin/payments",
    icon: DollarCircleIcon,
    match: (p) => p.startsWith("/admin/payments"),
  },
  {
    title: "Courses",
    href: "/admin/courses",
    icon: BookOpen01Icon,
    match: (p) => p.startsWith("/admin/courses"),
  },
  {
    title: "Reviews",
    href: "/admin/reviews",
    icon: StarIcon,
    match: (p) => p.startsWith("/admin/reviews"),
  },
  {
    title: "Exams",
    href: "/admin/exams",
    icon: Certificate01Icon,
    match: (p) => p.startsWith("/admin/exams"),
  },
]

function isActive(item: NavItem, pathname: string) {
  if (item.match) return item.match(pathname)
  return pathname === item.href
}

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useUser()

  const userInitials =
    `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "A"

  // Prefetch all navigation routes on mount for faster transitions
  useEffect(() => {
    manageItems.forEach((item) => router.prefetch(item.href))
  }, [router])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
              <Image
                src="/worldstreet-logo/WorldStreet1x.png"
                alt="WorldStreet Academy"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 object-contain"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">WorldStreet</span>
                <span className="truncate text-xs text-muted-foreground">
                  Admin Console
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
              {manageItems.map((item) => (
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
            <SidebarMenuButton render={<Link href="/instructor" />}>
              <HugeiconsIcon icon={TeachingIcon} size={18} />
              <span>Instructor Portal</span>
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
                  <span className="truncate font-medium text-xs">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <LogoutConfirmDialog>
              {(openLogout) => (
                <SidebarMenuButton render={<button type="button" onClick={openLogout} />}>
                  <HugeiconsIcon icon={Logout01Icon} size={18} />
                  <span>Log out</span>
                </SidebarMenuButton>
              )}
            </LogoutConfirmDialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
