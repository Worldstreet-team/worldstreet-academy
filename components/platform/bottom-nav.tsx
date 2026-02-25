"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Home01Icon,
  BookOpen01Icon,
  Mic01Icon,
  Bookmark01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { useVivid } from "@/lib/vivid/provider"

type BottomNavItem = {
  title: string
  href: string
  icon: IconSvgElement
  match?: (pathname: string) => boolean
}

const navItems: BottomNavItem[] = [
  {
    title: "Home",
    href: "/dashboard",
    icon: Home01Icon,
    match: (p: string) => p === "/dashboard",
  },
  {
    title: "My Courses",
    href: "/dashboard/my-courses",
    icon: BookOpen01Icon,
    match: (p: string) => p === "/dashboard/my-courses",
  },
  {
    title: "Bookmarks",
    href: "/dashboard/bookmarks",
    icon: Bookmark01Icon,
    match: (p: string) => p === "/dashboard/bookmarks",
  },
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: UserIcon,
    match: (p: string) => p === "/dashboard/profile",
  },
]

export function PlatformBottomNav() {
  const pathname = usePathname()
  const vivid = useVivid()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const isSessionActive = vivid.state !== "idle" && vivid.state !== "error"

  const isConnecting = vivid.state === "connecting"

  // Mini orb glow animation — green blob
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const size = 64
    canvas.width = size * 2
    canvas.height = size * 2

    const draw = () => {
      ctx.clearRect(0, 0, size * 2, size * 2)
      const speed = isConnecting ? 4500 : 1500
      const t = Date.now() / speed
      const levels = isSessionActive ? vivid.getAudioLevels() : new Uint8Array(0)
      const avg = levels.length > 0
        ? levels.reduce((a: number, b: number) => a + b, 0) / levels.length / 255
        : 0

      const connectPulse = isConnecting ? Math.sin(Date.now() / 300) * 4 : 0
      const baseR = 24 + avg * 8 + connectPulse
      const gradient = ctx.createRadialGradient(size, size, baseR * 0.2, size, size, baseR * 1.6)

      if (isConnecting) {
        gradient.addColorStop(0, `rgba(34,197,94,0.95)`)
        gradient.addColorStop(0.35, `rgba(22,163,74,0.7)`)
        gradient.addColorStop(0.7, `rgba(16,130,60,0.35)`)
        gradient.addColorStop(1, "rgba(16,130,60,0)")
      } else {
        gradient.addColorStop(0, `rgba(34,197,94,${0.85 + avg * 0.15})`)
        gradient.addColorStop(0.35, `rgba(22,163,74,${0.5 + avg * 0.3})`)
        gradient.addColorStop(0.7, `rgba(16,130,60,${0.2 + avg * 0.15})`)
        gradient.addColorStop(1, "rgba(16,130,60,0)")
      }

      ctx.fillStyle = gradient
      ctx.beginPath()
      const points = 64
      const noiseScale = isConnecting ? 2 : 1
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const noise = (Math.sin(angle * 3 + t) * 3 + Math.cos(angle * 5 + t * 1.3) * 2) * noiseScale
        const r = baseR + noise * (1 + avg * 4)
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
  }, [vivid, isSessionActive, isConnecting])

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
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={item.icon} size={20} />
              <span>{item.title}</span>
            </Link>
          )
        })}

        {/* Center CTA button — AI Orb (green blob, no container) */}
        <button
          onClick={() => {
            if (isConnecting) return
            if (isSessionActive) {
              vivid.setViewMode(vivid.viewMode === "minimized" ? "expanded" : "minimized")
            } else {
              vivid.startSession()
            }
          }}
          disabled={isConnecting}
          className="flex flex-col items-center gap-0.5 -mt-5 relative"
        >
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full ring-4 ring-background overflow-hidden">
            <canvas
              ref={canvasRef}
              className="absolute inset-[-50%] w-[200%] h-[200%] pointer-events-none"
            />
            {isConnecting ? (
              <div className="relative z-10 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-foreground/30 border-t-foreground/80 rounded-full animate-spin" />
              </div>
            ) : (
              <HugeiconsIcon
                icon={Mic01Icon}
                size={22}
                className="relative z-10 text-foreground/80 transition-colors"
              />
            )}
            {isSessionActive && !isConnecting && (
              <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-background z-10" />
            )}
          </div>
          <span className="text-[10px] font-medium text-foreground mt-0.5">
            AI
          </span>
        </button>

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
              <HugeiconsIcon icon={item.icon} size={20} />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
