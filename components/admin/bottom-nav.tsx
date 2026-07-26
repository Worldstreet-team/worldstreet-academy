"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Home01Icon,
  BookOpen01Icon,
  TeachingIcon,
  UserMultipleIcon,
  DollarCircleIcon,
} from "@hugeicons/core-free-icons"

type BottomNavItem = {
  title: string
  href: string
  icon: IconSvgElement
  match?: (pathname: string) => boolean
}

const navItems: BottomNavItem[] = [
  {
    title: "Overview",
    href: "/admin",
    icon: Home01Icon,
    match: (p: string) => p === "/admin",
  },
  {
    title: "Applications",
    href: "/admin/applications",
    icon: TeachingIcon,
    match: (p: string) => p.startsWith("/admin/applications"),
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: UserMultipleIcon,
    match: (p: string) => p.startsWith("/admin/users"),
  },
  {
    title: "Payments",
    href: "/admin/payments",
    icon: DollarCircleIcon,
    match: (p: string) => p.startsWith("/admin/payments"),
  },
  {
    title: "Courses",
    href: "/admin/courses",
    icon: BookOpen01Icon,
    match: (p: string) => p.startsWith("/admin/courses"),
  },
]

export function AdminBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur-md md:hidden safe-area-bottom">
      <div className="flex items-end justify-around px-2 pt-1 pb-2">
        {navItems.map((item) => {
          const active = item.match?.(pathname) ?? pathname === item.href
          return (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-3 text-[10px] transition-colors",
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={item.icon} size={20} />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
