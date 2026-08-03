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
  Bookmark,
  ChevronDown,
  CircleHelp,
  GraduationCap,
  House,
  LogOut,
  MessageCircle,
  Search,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { useUser } from "@/components/providers/user-provider"
import { LogoutConfirmDialog } from "@/components/shared/logout-confirm-dialog"
import { useUnreadCount } from "@/lib/hooks/use-unread-count"
import { useOngoingCall } from "@/components/providers/call-provider"
import { useSidebarActivity } from "@/lib/hooks/use-sidebar-activity"
import { useEnrollments } from "@/lib/hooks/queries"

/**
 * Platform sidebar — 260px rail per the design system's web layout pattern
 * (05-screens): icon 20 + label 15, active row a `bg/chip` pill, gold icon on
 * the active item (03-icons). Icons are Lucide, the system's standard set.
 *
 * Ordered by how often a learner actually needs each destination rather than
 * by feature area: resume → learn → talk → everything else. The four
 * cross-app WorldStreet links collapse behind one disclosure so they stop
 * competing with Academy navigation.
 */

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
}

/** Primary loop — the reasons a learner opens the Academy at all. */
const learnItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: House, match: (p) => p === "/dashboard" },
  {
    title: "My courses",
    href: "/dashboard/my-courses",
    icon: GraduationCap,
    match: (p) =>
      p === "/dashboard/my-courses" ||
      (p.startsWith("/dashboard/courses/") && p.includes("/learn")),
  },
  {
    title: "Browse courses",
    href: "/dashboard/courses",
    icon: Search,
    match: (p) => p === "/dashboard/courses",
  },
  {
    title: "Certificates",
    // `trophy` not `award`: award isn't in the design system's Lucide set,
    // trophy is (03-icons) and carries the same achievement meaning.
    href: "/dashboard/certificates",
    icon: Trophy,
    match: (p) => p === "/dashboard/certificates" || p.includes("/certificate"),
  },
]

/** Live/social — carries unread and in-progress state, so it sits on its own. */
const connectItems: NavItem[] = [
  {
    title: "Messages",
    href: "/dashboard/messages",
    icon: MessageCircle,
    match: (p) => p === "/dashboard/messages",
  },
  {
    title: "Meetings",
    href: "/dashboard/meetings",
    icon: Users,
    match: (p) => p.startsWith("/dashboard/meetings"),
  },
]

/** Low-frequency destinations. Reachable, but not competing for attention. */
const secondaryItems: NavItem[] = [
  {
    title: "Bookmarks",
    href: "/dashboard/bookmarks",
    icon: Bookmark,
    match: (p) => p === "/dashboard/bookmarks",
  },
  { title: "Wallet", href: "/dashboard/wallet", icon: Wallet, match: (p) => p.startsWith("/dashboard/wallet") },
  {
    title: "Help",
    href: "/dashboard/help",
    // KNOWN GAP: the design system's 66-icon Lucide set has no help/question
    // glyph, and nothing in it carries the meaning (message-circle is taken by
    // Messages, sparkles is Vivid). Using `circle-help` as a deliberate,
    // documented exception — `circle-help` should be added to 03-icons.md and
    // the Figma Icons page so the set stays authoritative.
    icon: CircleHelp,
    match: (p) => p === "/dashboard/help",
  },
]

// Cross-app link set per the DS TopNav spec (Dashboard · Academy · Xstream ·
// Social · Shop — Academy is this app). Labels match the DS; subdomains are
// what they are ("xtreme" hosts Xstream).
const worldstreetApps = [
  { title: "Dashboard", href: "https://dashboard.worldstreetgold.com" },
  { title: "Xstream", href: "https://xtreme.worldstreetgold.com" },
  { title: "Social", href: "https://social.worldstreetgold.com" },
  { title: "Shop", href: "https://shop.worldstreetgold.com" },
]

function isActive(item: NavItem, pathname: string) {
  return item.match ? item.match(pathname) : pathname === item.href
}

/** Count/state pill on the right of a nav row. */
function NavBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "brand" | "live" }) {
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
           `h-8` and `[&_svg]:size-4`, which would give 32px rows and 16px
           glyphs. The system wants 40px hit targets and 20px rail icons. */
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

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useUser()
  const unreadCount = useUnreadCount()
  const hasOngoingCall = useOngoingCall()
  const { activeMeetings, invites } = useSidebarActivity()
  const { data: enrollments = [] } = useEnrollments()
  const [appsOpen, setAppsOpen] = React.useState(false)

  const userInitials =
    `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
  const isInstructor = user.role === "INSTRUCTOR" || user.role === "ADMIN"

  /**
   * Resuming a course is the single most common reason a learner returns, and
   * it used to take three clicks (sidebar → dashboard → find the card). The
   * most recently touched unfinished course gets a dedicated row instead.
   */
  const resume = React.useMemo(() => {
    return [...enrollments]
      .filter((e) => e.progress < 100)
      .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())[0]
  }, [enrollments])

  const inProgressCount = enrollments.filter((e) => e.progress < 100).length
  const liveCount = activeMeetings.length + invites.length

  React.useEffect(() => {
    const routes = [
      ...learnItems.map((i) => i.href),
      ...connectItems.map((i) => i.href),
      ...secondaryItems.map((i) => i.href),
      isInstructor ? "/instructor" : "/dashboard/become-instructor",
    ]
    routes.forEach((r) => router.prefetch(r))
  }, [router, isInstructor])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Logo opens the public landing (`/home`), not the dashboard —
                the shell already lives at /dashboard; the brand mark is the
                one route back to the marketing page. */}
            <SidebarMenuButton
              size="lg"
              render={<Link href="/home" aria-label="WorldStreet Academy home" />}
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
        {/* Continue learning — the primary job, one click from anywhere.
            Hidden in the collapsed rail, where there's no room for context. */}
        {resume && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden pb-1">
            <SidebarGroupContent>
              <Link
                href={`/dashboard/courses/${resume.courseId}/learn/${resume.resumeLessonId ?? resume.firstLessonId ?? "first"}`}
                className="block rounded-md border border-ws-hairline bg-ws-raised/60 p-3 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ws-muted">
                  Continue learning
                </p>
                <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-ws-primary">
                  {resume.courseTitle}
                </p>
                <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-ws-track">
                  <div
                    className="h-full rounded-full bg-ws-brand"
                    style={{ width: `${Math.max(resume.progress, 2)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] tabular-nums text-ws-muted">
                  {resume.progress}% complete
                </p>
              </Link>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {learnItems.map((item) => (
                <NavRow
                  key={item.title}
                  item={item}
                  active={isActive(item, pathname)}
                  badge={
                    item.title === "My courses" && inProgressCount > 0 ? (
                      <NavBadge>{inProgressCount}</NavBadge>
                    ) : undefined
                  }
                />
              ))}
              {isInstructor && (
                <NavRow
                  item={{
                    title: "Teach",
                    href: "/instructor",
                    icon: GraduationCap,
                    match: (p) => p.startsWith("/instructor"),
                  }}
                  active={pathname.startsWith("/instructor")}
                />
              )}
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
              {secondaryItems.map((item) => (
                <NavRow key={item.title} item={item} active={isActive(item, pathname)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Teaching is a conversion action, not a destination — so it reads as
            a card, not as another nav row competing with navigation. */}
        {!isInstructor && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden mt-auto">
            <SidebarGroupContent>
              <Link
                href="/dashboard/become-instructor"
                className="block rounded-md border border-ws-hairline bg-ws-surface p-3 transition-colors duration-[var(--ws-motion-fast)] hover:bg-ws-raised"
              >
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} strokeWidth={2} className="text-ws-gold" />
                  <p className="text-[13px] font-semibold text-ws-primary">Teach on Academy</p>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ws-muted">
                  Share what you know and earn from your courses.
                </p>
              </Link>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Cross-app links, collapsed. They're a different product surface and
            were taking four rows away from Academy navigation. */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
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
                href="/dashboard/profile"
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
