"use client"
import { BookOpen, ClipboardCheck, Ellipsis, HandshakeIcon, House, Inbox, ReceiptText, ShieldCheck, Star, Store, Users, Wallet, type IconComponent } from "@/components/icons"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUser } from "@/components/providers/user-provider"
import { isSuperAdmin } from "@/lib/admin-levels"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

type BottomNavItem = {
  title: string
  href: string
  icon: IconComponent
  match?: (pathname: string) => boolean
}

const navItems: BottomNavItem[] = [
  {
    title: "Overview",
    href: "/admin",
    icon: House,
    match: (p: string) => p === "/admin",
  },
  {
    title: "Applications",
    href: "/admin/applications",
    icon: Inbox,
    match: (p: string) => p.startsWith("/admin/applications"),
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
    match: (p: string) => p.startsWith("/admin/users"),
  },
  {
    title: "Payments",
    href: "/admin/payments",
    icon: Wallet,
    match: (p: string) => p.startsWith("/admin/payments") && !p.startsWith("/admin/payments/espee"),
  },
]

/** ESPEE payments, Courses, Sellers, Partners, Reviews and Exams share the fifth slot behind a "More" menu. Team joins the menu for super admins. */
const moreItems: BottomNavItem[] = [
  {
    title: "ESPEE payments",
    href: "/admin/payments/espee",
    icon: ReceiptText,
    match: (p: string) => p.startsWith("/admin/payments/espee"),
  },
  {
    title: "Courses",
    href: "/admin/courses",
    icon: BookOpen,
    match: (p: string) => p.startsWith("/admin/courses"),
  },
  {
    title: "Sellers",
    href: "/admin/sellers",
    icon: Store,
    match: (p: string) => p.startsWith("/admin/sellers"),
  },
  {
    title: "Partners",
    href: "/admin/partners",
    icon: HandshakeIcon,
    match: (p: string) => p.startsWith("/admin/partners"),
  },
  {
    title: "Reviews",
    href: "/admin/reviews",
    icon: Star,
    match: (p: string) => p.startsWith("/admin/reviews"),
  },
  {
    title: "Exams",
    href: "/admin/exams",
    icon: ClipboardCheck,
    match: (p: string) => p.startsWith("/admin/exams"),
  },
]

/** Super admins only; first in the More menu. */
const teamItem: BottomNavItem = {
  title: "Team",
  href: "/admin/team",
  icon: ShieldCheck,
  match: (p: string) => p.startsWith("/admin/team"),
}

export function AdminBottomNav() {
  const pathname = usePathname()
  const user = useUser()
  const shownMore = isSuperAdmin(user) ? [teamItem, ...moreItems] : moreItems
  const moreActive = shownMore.some((item) => item.match?.(pathname) ?? pathname === item.href)

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-ws-hairline bg-ws-surface md:hidden safe-area-bottom">
      <div className="flex items-end justify-around px-2 pt-1 pb-2">
        {navItems.map((item) => {
          const active = item.match?.(pathname) ?? pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-[10px] transition-colors",
                active
                  ? "text-ws-gold font-medium"
                  : "text-ws-muted hover:text-ws-primary"
              )}
            >
              <Icon size={20} strokeWidth={2} />
              <span>{item.title}</span>
            </Link>
          )
        })}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-[10px] transition-colors",
                  moreActive
                    ? "text-ws-gold font-medium"
                    : "text-ws-muted hover:text-ws-primary"
                )}
              />
            }
          >
            <Ellipsis size={20} strokeWidth={2} />
            <span>More</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-44">
            {shownMore.map((item) => {
              const active = item.match?.(pathname) ?? pathname === item.href
              const Icon = item.icon
              return (
                <DropdownMenuItem key={item.title} render={<Link href={item.href} />}>
                  <Icon
                    size={16}
                    strokeWidth={2}
                    className={active ? "text-ws-gold" : "text-ws-muted"}
                  />
                  {item.title}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
