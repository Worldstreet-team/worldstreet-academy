"use client"

import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { MoonIcon, SunIcon } from "lucide-react"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted transition-colors",
        className
      )}
    >
      <SunIcon
        
        size={16}
        className="rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0" />
      <MoonIcon
        
        size={16}
        className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  )
}
