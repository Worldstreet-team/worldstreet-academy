"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { BookOpenIcon, BookmarkIcon, HouseIcon, MicIcon, UserIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { RenderIcon } from "@/components/shared/render-icon"

type BottomNavItem = {
  title: string
  href: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
}

const navItems: BottomNavItem[] = [
  {
    title: "Home",
    href: "/dashboard",
    icon: HouseIcon,
    match: (p: string) => p === "/dashboard",
  },
  {
    title: "My Courses",
    href: "/dashboard/my-courses",
    icon: BookOpenIcon,
    match: (p: string) => p === "/dashboard/my-courses",
  },
  {
    title: "Bookmarks",
    href: "/dashboard/bookmarks",
    icon: BookmarkIcon,
    match: (p: string) => p === "/dashboard/bookmarks",
  },
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: UserIcon,
    match: (p: string) => p === "/dashboard/profile",
  },
]

// The hosted Vivid widget (loaded site-wide in the root layout) mounts its orb
// asynchronously and only when the platform accepts this origin — so the
// center AI button is a proxy: it appears once the orb exists and clicking it
// forwards to the widget. No orb, no button, no crash.
function findVividOrb(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("[data-vivid] button") ??
    document.querySelector<HTMLElement>("[data-vivid]")
  )
}

export function PlatformBottomNav() {
  const pathname = usePathname()
  const [orbReady, setOrbReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (findVividOrb()) {
      setOrbReady(true)
      return
    }
    const started = Date.now()
    const poll = setInterval(() => {
      if (findVividOrb()) {
        setOrbReady(true)
        clearInterval(poll)
      } else if (Date.now() - started > 15_000) {
        clearInterval(poll)
      }
    }, 500)
    return () => clearInterval(poll)
  }, [])

  // Mini orb glow animation — Academy accent blob
  useEffect(() => {
    if (!orbReady) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const size = 64
    canvas.width = size * 2
    canvas.height = size * 2

    // Canvas can't resolve CSS variables — read the Academy accent token once
    // per mount so the orb tracks the design system, not a hardcoded green.
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--ws-accent-academy")
      .trim() || "#10B981"
    const r0 = parseInt(accent.slice(1, 3), 16)
    const g0 = parseInt(accent.slice(3, 5), 16)
    const b0 = parseInt(accent.slice(5, 7), 16)
    const rgba = (a: number) => `rgba(${r0},${g0},${b0},${a})`

    const draw = () => {
      ctx.clearRect(0, 0, size * 2, size * 2)
      const t = Date.now() / 1500
      const baseR = 24
      const gradient = ctx.createRadialGradient(size, size, baseR * 0.2, size, size, baseR * 1.6)
      gradient.addColorStop(0, rgba(0.85))
      gradient.addColorStop(0.35, rgba(0.5))
      gradient.addColorStop(0.7, rgba(0.2))
      gradient.addColorStop(1, rgba(0))

      ctx.fillStyle = gradient
      ctx.beginPath()
      const points = 64
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const noise = Math.sin(angle * 3 + t) * 3 + Math.cos(angle * 5 + t * 1.3) * 2
        const r = baseR + noise
        const x = size + Math.cos(angle) * r
        const y = size + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [orbReady])

  const left = navItems.slice(0, 2)
  const right = navItems.slice(2)

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-ws-surface md:hidden safe-area-bottom">
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
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <RenderIcon icon={item.icon}  size={20} />
              <span>{item.title}</span>
            </Link>
          )
        })}

        {/* Center CTA button — AI Orb (green blob, no container) */}
        {orbReady && (
          <button
            onClick={() => findVividOrb()?.click()}
            className="flex flex-col items-center gap-0.5 -mt-5 relative"
          >
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full ring-4 ring-background overflow-hidden">
              <canvas
                ref={canvasRef}
                className="absolute inset-[-50%] w-[200%] h-[200%] pointer-events-none"
              />
              <MicIcon
                size={22}
                className="relative z-10 text-foreground/80 transition-colors" />
            </div>
            <span className="text-[10px] font-medium text-foreground mt-0.5">
              AI
            </span>
          </button>
        )}

        {right.map((item) => {
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
              <RenderIcon icon={item.icon}  size={20} />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
