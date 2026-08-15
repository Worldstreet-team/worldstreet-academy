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
import {
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  House,
  Inbox,
  LayoutDashboard,
  LogOut,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { useUser } from "@/components/providers/user-provider"
import { LogoutConfirmDialog } from "@/components/shared/logout-confirm-dialog"

/**
 * Admin rail — mirrors the platform sidebar recipe (app-sidebar.tsx): 40px
 * pill rows, 20px Lucide glyphs, `bg/chip` active pill with a gold icon.
 */

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
}

const manageItems: NavItem[] = [
  {
    title: "Overview",
    href: "/admin",
    icon: House,
    match: (p) => p === "/admin",
  },
  {
    title: "Applications",
    href: "/admin/applications",
    icon: Inbox,
    match: (p) => p.startsWith("/admin/applications"),
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
    match: (p) => p.startsWith("/admin/users"),
  },
  {
    title: "Payments",
    href: "/admin/payments",
    icon: Wallet,
    match: (p) => p.startsWith("/admin/payments"),
  },
  {
    title: "Courses",
    href: "/admin/courses",
    icon: BookOpen,
    match: (p) => p.startsWith("/admin/courses"),
  },
  {
    title: "Enrollments",
    href: "/admin/enrollments",
    icon: GraduationCap,
    match: (p) => p.startsWith("/admin/enrollments"),
  },
  {
    title: "Reviews",
    href: "/admin/reviews",
    icon: Star,
    match: (p) => p.startsWith("/admin/reviews"),
  },
  {
    title: "Exams",
    href: "/admin/exams",
    icon: ClipboardCheck,
    match: (p) => p.startsWith("/admin/exams"),
  },
]

function isActive(item: NavItem, pathname: string) {
  if (item.match) return item.match(pathname)
  return pathname === item.href
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
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
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
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
            <SidebarMenuButton
              size="lg"
              render={<Link href="/admin" />}
              className="rounded-md transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-chip"
            >
              {/* Unified ecosystem lockup (05-screens): gold wsa-mark 26px +
                  "WorldStreet" Poppins SemiBold 15 + gold app eyebrow. */}
              <Image
                src="/brand/wsa-mark.png"
                alt="WorldStreet Academy"
                width={26}
                height={26}
                className="h-[26px] w-[26px] shrink-0 object-contain"
              />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-display text-[15px] font-semibold">WorldStreet</span>
                <span className="truncate font-sans text-[10px] font-semibold uppercase tracking-[2px] text-ws-gold">Admin</span>
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
                <NavRow key={item.title} item={item} active={isActive(item, pathname)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/dashboard" />}
              className="!h-10 gap-3 rounded-full px-3 text-[15px] font-medium transition-colors duration-[var(--ws-motion-fast)] [&_svg]:!size-5"
            >
              <LayoutDashboard size={20} strokeWidth={2} className="text-ws-muted" />
              <span className="truncate">Student Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/instructor" />}
              className="!h-10 gap-3 rounded-full px-3 text-[15px] font-medium transition-colors duration-[var(--ws-motion-fast)] [&_svg]:!size-5"
            >
              <GraduationCap size={20} strokeWidth={2} className="text-ws-muted" />
              <span className="truncate">Instructor Portal</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-7 w-7 shrink-0">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                  <AvatarFallback className="bg-ws-chip text-xs text-ws-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight min-w-0">
                  <span className="truncate text-xs font-medium text-ws-primary">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="truncate text-[10px] text-ws-subtle">
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
                <SidebarMenuButton
                  render={<button type="button" onClick={openLogout} />}
                  className="!h-10 gap-3 rounded-full px-3 text-[15px] font-medium transition-colors duration-[var(--ws-motion-fast)] [&_svg]:!size-5"
                >
                  <LogOut size={20} strokeWidth={2} className="text-ws-muted" />
                  <span className="truncate">Log out</span>
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
