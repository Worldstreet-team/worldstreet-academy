"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useTransition, useEffect } from "react"
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
  Analytics01Icon,
  Logout01Icon,
  Message01Icon,
  DashboardSpeed01Icon,
  Call02Icon,
  MeetingRoomIcon,
  Globe02Icon,
  BitcoinIcon,
  ShoppingBag01Icon,
  PlayIcon,
  UserMultipleIcon,
  Video01Icon,
  Certificate01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { useUser } from "@/components/providers/user-provider"
import { useClerk } from "@clerk/nextjs"
import { useUnreadCount } from "@/lib/hooks/use-unread-count"
import { useOngoingCall, useActiveCallInfo } from "@/components/providers/call-provider"
import { useSidebarActivity } from "@/lib/hooks/use-sidebar-activity"

type NavItem = {
  title: string
  href: string
  icon: IconSvgElement
  match?: (pathname: string) => boolean
}

const teachItems: NavItem[] = [
  {
    title: "Overview",
    href: "/instructor",
    icon: Home01Icon,
    match: (p) => p === "/instructor",
  },
  {
    title: "Profile",
    href: "/instructor/profile",
    icon: UserIcon,
    match: (p) => p === "/instructor/profile",
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
    title: "Certificates",
    href: "/instructor/certificates",
    icon: Certificate01Icon,
    match: (p) => p.startsWith("/instructor/certificates"),
  },
  {
    title: "Analytics",
    href: "/instructor/analytics",
    icon: Analytics01Icon,
    match: (p) => p === "/instructor/analytics",
  },
]

const connectItems: NavItem[] = [
  {
    title: "Messages",
    href: "/instructor/messages",
    icon: Message01Icon,
    match: (p) => p === "/instructor/messages",
  },
  {
    title: "Meetings",
    href: "/instructor/meetings",
    icon: MeetingRoomIcon,
    match: (p) => p.startsWith("/instructor/meetings"),
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

export function InstructorSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useUser()
  const { signOut } = useClerk()
  const [isPending, startTransition] = useTransition()
  const unreadCount = useUnreadCount()
  const hasOngoingCall = useOngoingCall()
  const callInfo = useActiveCallInfo()
  const { activeMeetings, invites, hasActivity } = useSidebarActivity()

  const userInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"

  // Prefetch all navigation routes on mount for faster transitions
  useEffect(() => {
    const allRoutes = [
      ...teachItems.map((item) => item.href),
      ...connectItems.map((item) => item.href),
    ]
    allRoutes.forEach((route) => {
      router.prefetch(route)
    })
  }, [router])

  function handleLogout() {
    startTransition(async () => {
      try {
        await signOut()
      } catch (error) {
        console.error("Sign out error:", error)
      } finally {
        // Always redirect regardless of signOut result
        window.location.href = "https://www.worldstreetgold.com/login"
      }
    })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/instructor" />}>
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
                  Instructor Portal
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Teach</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {teachItems.map((item) => (
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
                      <SidebarMenuButton render={<Link href={`/instructor/meetings?join=${m.id}`} />}>
                        <HugeiconsIcon icon={Video01Icon} size={18} className="text-muted-foreground" />
                        <span className="truncate text-xs">{m.title.length > 18 ? m.title.slice(0, 18) + "..." : m.title}</span>
                        <span className="ml-auto flex items-center -space-x-1.5 shrink-0">
                          {m.participantAvatars?.slice(0, 4).map((p, i) => (
                            <Avatar key={i} className="w-4 h-4 border border-sidebar-accent ring-1 ring-sidebar-accent">
                              <AvatarImage src={p.avatar || ""} alt={p.name} />
                              <AvatarFallback className="text-[6px]">
                                {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {m.participantCount > 4 && (
                            <span className="flex items-center justify-center w-4 h-4 rounded-full border border-sidebar-accent ring-1 ring-sidebar-accent bg-muted text-[6px] font-semibold text-muted-foreground">
                              +{m.participantCount - 4}
                            </span>
                          )}
                          {(!m.participantAvatars || m.participantAvatars.length === 0) && (
                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {invites.slice(0, 2).map((inv) => (
                    <SidebarMenuItem key={inv.id}>
                      <SidebarMenuButton render={<Link href={`/instructor/meetings?join=${inv.meetingId}`} />}>
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
                    {item.title === "Messages" && hasOngoingCall && callInfo && (
                      <span className="ml-auto flex items-center -space-x-1.5 shrink-0">
                        <Avatar className="w-5 h-5 border-2 border-sidebar-accent ring-1 ring-sidebar-accent">
                          <AvatarImage src={user.avatarUrl || ""} />
                          <AvatarFallback className="text-[7px] bg-primary/10 text-primary">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <Avatar className="w-5 h-5 border-2 border-sidebar-accent ring-1 ring-sidebar-accent">
                          <AvatarImage src={callInfo.participantAvatar || ""} />
                          <AvatarFallback className="text-[7px] bg-emerald-500/15 text-emerald-600">
                            {callInfo.participantName?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </span>
                    )}
                    {item.title === "Messages" && hasOngoingCall && !callInfo && (
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
