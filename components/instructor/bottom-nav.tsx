"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  ChartLine,
  House,
  Plus,
  Settings,
  type LucideIcon,
} from "lucide-react"

type BottomNavItem = {
  title: string
  href: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
}

const navItems: BottomNavItem[] = [
  {
    title: "Overview",
    href: "/instructor",
    icon: House,
    match: (p: string) => p === "/instructor",
  },
  {
    title: "Courses",
    href: "/instructor/courses",
    icon: BookOpen,
    match: (p: string) =>
      p === "/instructor/courses" ||
      (p.startsWith("/instructor/courses/") && !p.endsWith("/new")),
  },
  // CTA placeholder — rendered separately
  {
    title: "Analytics",
    href: "/instructor/analytics",
    icon: ChartLine,
    match: (p: string) => p === "/instructor/analytics",
  },
  {
    title: "Settings",
    href: "/instructor/settings",
    icon: Settings,
    match: (p: string) => p === "/instructor/settings",
  },
]

export function InstructorBottomNav() {
  const pathname = usePathname()

  const left = navItems.slice(0, 2)
  const right = navItems.slice(2)

  const renderItem = (item: BottomNavItem) => {
    const active = item.match?.(pathname) ?? pathname === item.href
    const Icon = item.icon
    return (
      <Link
        key={item.title}
        href={item.href}
        className={cn(
          "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] transition-colors duration-[var(--ws-motion-fast)]",
          active
            ? "font-medium text-ws-gold"
            : "text-ws-muted hover:text-ws-primary"
        )}
      >
        <Icon size={20} strokeWidth={2} />
        <span>{item.title}</span>
      </Link>
    )
  }

  return (
    <nav className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 border-t border-ws-hairline bg-ws-surface md:hidden">
      <div className="flex items-end justify-around px-2 pb-2 pt-1">
        {left.map(renderItem)}

        {/* Center CTA button */}
        <Link
          href="/instructor/courses/new"
          className="-mt-5 flex flex-col items-center gap-0.5"
        >
          <div className="flex h-13 w-13 items-center justify-center rounded-full bg-ws-brand text-ws-brand-on ring-4 ring-ws-surface transition-opacity duration-[var(--ws-motion-fast)] hover:opacity-90">
            <Plus size={22} strokeWidth={2} />
          </div>
          <span className="mt-0.5 text-[10px] font-medium text-ws-primary">
            Add Course
          </span>
        </Link>

        {right.map(renderItem)}
      </div>
    </nav>
  )
}
