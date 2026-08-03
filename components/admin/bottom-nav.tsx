"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  ClipboardCheck,
  Ellipsis,
  House,
  Inbox,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

type BottomNavItem = {
  title: string
  href: string
  icon: LucideIcon
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
    match: (p: string) => p.startsWith("/admin/payments"),
  },
]

/** Courses, Reviews and Exams share the fifth slot behind a "More" menu. */
const moreItems: BottomNavItem[] = [
  {
    title: "Courses",
    href: "/admin/courses",
    icon: BookOpen,
    match: (p: string) => p.startsWith("/admin/courses"),
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

export function AdminBottomNav() {
  const pathname = usePathname()
  const moreActive = moreItems.some((item) => item.match?.(pathname) ?? pathname === item.href)

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
                "flex flex-col items-center gap-0.5 py-1.5 px-3 text-[10px] transition-colors",
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
                  "flex flex-col items-center gap-0.5 py-1.5 px-3 text-[10px] transition-colors",
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
            {moreItems.map((item) => {
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
