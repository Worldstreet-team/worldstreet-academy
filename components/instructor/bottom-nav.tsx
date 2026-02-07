"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Home01Icon,
  BookOpen01Icon,
  Add01Icon,
  Analytics01Icon,
  Settings01Icon,
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
    href: "/instructor",
    icon: Home01Icon,
    match: (p: string) => p === "/instructor",
  },
  {
    title: "Courses",
    href: "/instructor/courses",
    icon: BookOpen01Icon,
    match: (p: string) =>
      p === "/instructor/courses" ||
      (p.startsWith("/instructor/courses/") && !p.endsWith("/new")),
  },
  // CTA placeholder — rendered separately
  {
    title: "Analytics",
    href: "/instructor/analytics",
    icon: Analytics01Icon,
    match: (p: string) => p === "/instructor/analytics",
  },
  {
    title: "Settings",
    href: "/instructor/settings",
    icon: Settings01Icon,
    match: (p: string) => p === "/instructor/settings",
  },
]

export function InstructorBottomNav() {
  const pathname = usePathname()

  const left = navItems.slice(0, 2)
  const right = navItems.slice(2)

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur-md md:hidden safe-area-bottom">
      <div className="flex items-end justify-around px-2 pt-1 pb-2">
        {left.map((item) => {
          const active = item.match?.(pathname) ?? pathname === item.href
          return (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-3 text-[10px] transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={item.icon} size={20} />
              <span>{item.title}</span>
            </Link>
          )
        })}

        {/* Center CTA button */}
        <Link
          href="/instructor/courses/new"
          className="flex flex-col items-center gap-0.5 -mt-5"
        >
          <div className="flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background">
            <HugeiconsIcon icon={Add01Icon} size={22} />
          </div>
          <span className="text-[10px] font-medium text-primary mt-0.5">
            Add Course
          </span>
        </Link>

        {right.map((item) => {
          const active = item.match?.(pathname) ?? pathname === item.href
          return (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-3 text-[10px] transition-colors",
                active
                  ? "text-primary"
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
